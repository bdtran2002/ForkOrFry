# Hurry Curry! - a game about cooking
# Copyright (C) 2026 Hurry Curry! Contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, version 3 of the License only.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
class_name Multiplayer
extends Node

signal packet(packet: Dictionary)
signal connection_closed()

static var VERSION_MAJOR: int = 13
const LOCAL_BRIDGE_URL := "forkorfry-local://bootstrap"

var connected := false
var bridge_mode := false
var socket: WebSocketPeer
var keep_alive := Timer.new()
var bridge_bootstrap: Dictionary = {}

func update_forkorfry_bridge_state(state: String, extra: Dictionary = {}):
	if not OS.has_feature("web"):
		return

	var console = JavaScriptBridge.get_interface("console")
	if console != null:
		console.log("ForkOrFry multiplayer state", state, JSON.stringify(extra))

	var state_json = JSON.stringify(state)
	var payload_json = JSON.stringify(extra)
	JavaScriptBridge.eval("""
		(function () {
			window.__FORKORFRY_GODOT_MULTIPLAYER_STATE__ = %s;
			window.__FORKORFRY_GODOT_MULTIPLAYER_EXTRA_JSON__ = %s;
			window.__FORKORFRY_GODOT_LAST_UPDATE__ = 'multiplayer';
			var current = window.__FORKORFRY_GODOT_BRIDGE__ || {};
			current.multiplayerState = %s;
			current.multiplayerUpdatedAt = new Date().toISOString();
			var extra = %s || {};
			for (var key in extra) current[key] = extra[key];
			window.__FORKORFRY_GODOT_BRIDGE__ = current;
			window.__FORKORFRY_GODOT_BRIDGE_JSON__ = JSON.stringify(current);
		}());
	""" % [state_json, payload_json, state_json, payload_json])

func _ready():
	add_child(keep_alive)
	keep_alive.wait_time = 1.
	keep_alive.timeout.connect(send_keep_alive)
	update_forkorfry_bridge_state("multiplayer-ready")

func connect_to_urls(urls: Array[String]):
	if is_local_bridge_bootstrap(urls):
		update_forkorfry_bridge_state("multiplayer-connect:local-bridge", {
			"connectUrls": urls,
		})
		connect_to_bridge_bootstrap()
		return

	if urls.is_empty():
		update_forkorfry_bridge_state("multiplayer-connect:missing-url")
		connection_closed.emit("No connection address available.")
		return

	var error_info: Dictionary[String, int] = {}

	# Create a WebSocketPeer for each url
	var peers: Array[WebSocketPeer] = []
	for url: String in urls:
		var ws := WebSocketPeer.new()
		ws.inbound_buffer_size = 1024 * 1024 * 4
		var err := ws.connect_to_url(url)
		if err == OK: peers.append(ws)
		else: error_info[url] = err

	# Now keep polling until one of them is succesful, or we run out of peers.
	# Peers are removed from the peers array when they fail to connect.
	var open_peer_found := false
	while not peers.is_empty() and not open_peer_found:
		await get_tree().physics_frame
		for peer: WebSocketPeer in peers:
			peer.poll()
			var state := peer.get_ready_state()
			match state:
				WebSocketPeer.STATE_CLOSED:
					print("URL %s failed" % peer.get_requested_url())
					error_info[peer.get_requested_url()] = peer.get_close_code()
					peers.erase(peer)
				WebSocketPeer.STATE_OPEN:
					# We found a connection that works. Close all others.
					print("URL %s connected!" % peer.get_requested_url())
					socket = peer
					var other_peers := peers.filter(func (p): return p != peer)
					for p: WebSocketPeer in other_peers:
						p.close()
					open_peer_found = true
					break
				_:	pass

	if not open_peer_found:
		update_forkorfry_bridge_state("multiplayer-connect:failed", {
			"connectErrors": error_info,
		})
		var err_msg: String = tr("c.error.could_not_connect")
		for url: String in error_info.keys():
			err_msg += "\nURL %s failed with code %d" % [url, error_info[url]]
		connection_closed.emit(err_msg)
		return

	connected = true
	keep_alive.start()
	update_forkorfry_bridge_state("multiplayer-connect:websocket-open", {
		"connectUrl": socket.get_requested_url(),
	})

func is_local_bridge_bootstrap(urls: Array[String]) -> bool:
	return urls.size() == 1 and urls[0] == LOCAL_BRIDGE_URL

func connect_to_bridge_bootstrap() -> void:
	if not OS.has_feature("web"):
		update_forkorfry_bridge_state("multiplayer-bridge:non-web")
		connection_closed.emit("ForkOrFry local bridge is only available in the web export.")
		return

	var payload_json = JavaScriptBridge.eval("JSON.stringify(window.__FORKORFRY_BOOT__ ?? null)")
	if payload_json == null or payload_json == "null":
		update_forkorfry_bridge_state("multiplayer-bridge:missing-payload")
		connection_closed.emit("ForkOrFry local bridge payload missing.")
		return

	var payload = JSON.parse_string(payload_json)
	if not payload is Dictionary or payload.get("type") != "forkorfry:local-bootstrap" or not payload.get("packets") is Array:
		update_forkorfry_bridge_state("multiplayer-bridge:invalid-payload")
		connection_closed.emit("ForkOrFry local bridge payload invalid.")
		return

	bridge_bootstrap = payload
	bridge_mode = true
	connected = true
	keep_alive.start()
	update_forkorfry_bridge_state("multiplayer-bridge:connected", {
		"bootstrapSessionId": str(payload.get("sessionId", "")),
		"bootstrapPacketCount": payload.get("packets", []).size(),
	})
	call_deferred("emit_bridge_bootstrap")

func emit_bridge_bootstrap() -> void:
	if not bridge_mode:
		return

	var emitted_packets := 0
	for packet_data in bridge_bootstrap.get("packets", []):
		if not packet_data is Dictionary:
			continue
		emitted_packets += 1
		handle_decoded_packet(packet_data)

	update_forkorfry_bridge_state("multiplayer-bridge:packets-emitted", {
		"emittedPacketCount": emitted_packets,
	})

func _notification(what):
	if what == NOTIFICATION_PREDELETE and socket != null:
		socket.close()
		connected = false

func _process(_delta):
	if bridge_mode:
		return

	if connected:
		socket.poll()
		var state = socket.get_ready_state()
		while socket.get_available_packet_count():
			handle_packet(socket.get_packet())
		if state == WebSocketPeer.STATE_CLOSED:
			update_forkorfry_bridge_state("multiplayer-connect:closed")
			connection_closed.emit("c.error.connection_closed")
			connected = false

func fix_packet_types(val: Variant):
	match typeof(val):
		TYPE_FLOAT: return val
		TYPE_INT: return float(val)
		TYPE_STRING: return val
		TYPE_BOOL: return val
		TYPE_ARRAY: return val.map(fix_packet_types)
		TYPE_DICTIONARY:
			var new_dict = {}
			for k in val.keys():
				if val[k] is Array and val[k].size() == 2:
					# A Vector2 is represented as an array with 2 elements in our protocol.
					# We need to convert it to Godot's Vector2 type for easier handling.
					if k in ["tile"]: new_dict[k] = Vector2i(val[k][0], val[k][1]) # TODO: Are these still necessary?
					elif k in ["pos", "position", "dir"]: new_dict[k] = Vector2(val[k][0], val[k][1])
					else: new_dict[k] = fix_packet_types(val[k])
				else: new_dict[k] = fix_packet_types(val[k])
			return new_dict
		_: return val

func handle_packet(coded):
	var p = decode_packet(coded)
	if p == null:
		return
	handle_decoded_packet(p)

func handle_decoded_packet(decoded_packet: Dictionary):
	var p = fix_packet_types(decoded_packet)

	match p["type"]:
		"version":
			var major = p["major"]
			update_forkorfry_bridge_state("multiplayer-packet:version", {
				"protocolMajor": major,
			})
			if major != VERSION_MAJOR:
				socket.close()
				connected = false
				update_forkorfry_bridge_state("multiplayer-packet:version-mismatch", {
					"protocolMajor": major,
					"expectedProtocolMajor": VERSION_MAJOR,
				})
				connection_closed.emit(tr("c.error.version_mismatch").format([major, 0, VERSION_MAJOR, 0]))
		_:
			update_forkorfry_bridge_state("multiplayer-packet:%s" % str(p["type"]))
			packet.emit(p)

func send_local_bridge_gameplay_packet(action: String, payload: Dictionary) -> void:
	if not OS.has_feature("web"):
		return

	update_forkorfry_bridge_state("multiplayer-bridge:gameplay-packet:%s" % action, {
		"action": action,
		"payload": payload,
	})
	var action_json = JSON.stringify(action)
	var payload_json = JSON.stringify(payload)
	JavaScriptBridge.eval("""
		(function () {
			window.parent.postMessage({
				type: 'forkorfry:bridge-gameplay-packet',
				version: 1,
				action: %s,
				payload: %s,
			}, window.location.origin);
		}());
	""" % [action_json, payload_json])

func send_join(player_name: String, character_style: Dictionary):
	send_packet({
		"type": "join",
		"name": player_name,
		"character": character_style
	})

func send_position(player, pos: Vector2):
	send_packet({
		"type": "movement",
		"player": player,
		"pos": [pos.x, pos.y],
	})

func send_movement(player, pos: Vector2, direction: Vector2, boost: bool):
	if bridge_mode:
		send_local_bridge_gameplay_packet("movement", {
			"player": player,
			"pos": [pos.x, pos.y],
			"dir": [direction.x, direction.y],
			"boost": boost,
		})
		return

	send_packet({
		"type": "movement",
		"player": player,
		"pos": [pos.x, pos.y],
		"dir": [direction.x, direction.y],
		"boost": boost
	})


func send_tile_interact(player, pos: Vector2i, edge: bool, hand: int):
	@warning_ignore("incompatible_ternary")
	if bridge_mode:
		send_local_bridge_gameplay_packet("interact", {
			"player": player,
			"target": {"tile": [pos.x, pos.y]} if edge else null,
			"hand": hand,
		})
		return

	send_packet({
		"type": "interact",
		"player": player,
		"target": {"tile": [pos.x, pos.y]} if edge else null,
		"hand": hand,
	})

func send_player_interact(player, target_player, target_hand: int, edge: bool, hand: int):
	@warning_ignore("incompatible_ternary")
	if bridge_mode:
		send_local_bridge_gameplay_packet("interact", {
			"player": player,
			"target": {"player": [target_player, target_hand]} if edge else null,
			"hand": hand,
		})
		return

	send_packet({
		"type": "interact",
		"player": player,
		"target": {"player": [target_player, target_hand]} if edge else null,
		"hand": hand,
	})

func send_chat(player, message: String):
	send_packet({
		"type": "communicate",
		"player": player,
		"persist": false,
		"message": {
			"text": message
		}
	})

func send_replay_tick(dt: float):
	send_packet({
		"type": "replay_tick",
		"dt": dt
	})

func send_idle(paused: bool):
	if bridge_mode:
		send_local_bridge_gameplay_packet("idle", {
			"paused": paused,
		})
		return

	send_packet({
		"type": "idle",
		"paused": paused,
	})

func send_leave(player):
	send_packet({
		"type": "leave",
		"player": player,
	})

func send_ready():
	if bridge_mode:
		send_local_bridge_gameplay_packet("ready", {})
		return

	send_packet({
		"type": "ready"
	})

func send_start_game_vote(player_id: float, map: String, hand_count = 1, bots = []):
	var config := {
		"map": map
	}
	if hand_count != null: config["hand_count"] = hand_count
	if bots != null: config["bots"] = bots
	send_packet({
		"type": "initiate_vote",
		"player": player_id,
		"subject": {
			"action": "start_game",
			"config": config
		}
	})

func cast_vote(player_id: float, agree: bool):
	send_packet({
		"type": "cast_vote",
		"player": player_id,
		"agree": agree
	})

func send_keep_alive() -> void:
	send_packet({
		"type": "keepalive"
	})

func send_packet(p):
	if bridge_mode:
		return

	var json = JSON.stringify(p)
	if socket.get_ready_state() != WebSocketPeer.State.STATE_OPEN:
		push_warning("Can not send packet: Socket not open")
		return
	socket.send_text(json)

func decode_packet(bytes: PackedByteArray):
	var json = JSON.new()
	var in_str = bytes.get_string_from_utf8()
	var error = json.parse(in_str)
	if error == OK:
		return json.data
	else:
		print("Decode of packet failed: %s in %s" % [json.get_error_message(), in_str])
		return null
