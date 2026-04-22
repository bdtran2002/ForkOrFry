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
class_name Game
extends Node3D

signal update_players(players: Dictionary)
signal data_updated()
signal join_state_updated(state: JoinState)
signal text_message(message: TextMessage)
signal update_tutorial_running(running: bool)

class TextMessage:
	var username #: String
	var color: Color
	var text: String
	var timeout_initial: float
	var timeout_remaining

class ServerContext:
	var name: String
	var motd#: String?
	func _init(name_: String, motd_) -> void:
		name = name_; motd = motd_

enum SpectatingMode {
	CENTER,
	FREE,
}

enum JoinState {
	SPECTATING,
	WAITING,
	JOINED,
}

var my_player_id: float = -1
var item_names: Array = []
var tile_names: Array = []
var tile_collide: Array[String] = []
var tile_placeable_any: Array[String] = []
var tile_placeable_items: Dictionary[String, Array] = {} # Dictionary[String, Array[String]]
var tile_interactable_empty: Array[String] = []
var maps: Array = []
var server_context: ServerContext
var bot_algos: Array
var text_message_history: Array[TextMessage] = []
var send_message_history: Array[String] = []

var join_state: JoinState = JoinState.SPECTATING

var in_lobby := false
var previously_in_lobby := in_lobby
var is_replay := false
var tutorial_running := false
var tutorial_queue := []

var players: Dictionary[float, Player] = {}
var spectator_count := 0

var spectating_mode: SpectatingMode = SpectatingMode.CENTER

@onready var mp: Multiplayer = $Multiplayer
@onready var map: Map = $Map
# TODO move all of this somewhere else
@onready var overlay_score: Overlay = $"../Overlays/Score"
@onready var overlay_popup_message: PopupMessage = $"../Overlays/PopupMessage"
@onready var overlay_pinned_messages: PinnedItemMessages = $"../Overlays/VBox/PinnedMessages"
@onready var overlay_vote: Vote = $"../Overlays/VBox/Vote"
@onready var overlay_announce_title: AnnounceTitle = $"../Overlays/AnnounceTitle"
@onready var menu: GameMenu = $".."
@onready var follow_camera: FollowCamera = $FollowCamera

func debug_game_state(state: String, extra: Dictionary = {}):
	if not OS.has_feature("web"):
		return

	var console = JavaScriptBridge.get_interface("console")
	if console != null:
		console.log("ForkOrFry game state", state, JSON.stringify(extra))

func _ready():
	debug_game_state("game-ready", {
		"menuData": menu.data,
	})
	mp.packet.connect(handle_packet)
	mp.connection_closed.connect(func(reason: String):
		debug_game_state("game-connection-closed", {
			"reason": reason,
		})
		show_error(reason)
	)
	mp.connect_to_urls(menu.data)
	
	text_message.connect(func(m):
		text_message_history.push_back(m)
		while text_message_history.size() > 64:
			text_message_history.pop_front()
	)

func handle_packet(p):
	match p.type:
		"joined":
			my_player_id = p.id
			debug_game_state("game-packet:joined", {
				"playerId": p.id,
			})
		"server_data":
			maps = p["maps"]
			bot_algos = p["bot_algos"]
			server_context = ServerContext.new(p["name"], p["motd"])
			debug_game_state("game-packet:server_data", {
				"mapCount": maps.size(),
				"botAlgoCount": bot_algos.size(),
				"serverName": p["name"],
			})
		"game_data":
			item_names = p["item_names"]
			tile_names = p["tile_names"]
			tile_collide = []
			tile_interactable_empty = []
			tile_placeable_any = []
			tile_placeable_items = {}
			for tile in p["tile_collide"]: tile_collide.append(tile_names[int(tile)])
			for tile in p["tile_interactable_empty"]: tile_interactable_empty.append(tile_names[int(tile)])
			for tile in p["tile_placeable_any"]: tile_placeable_any.append(tile_names[int(tile)])
			for tile in p["tile_placeable_items"]:
				tile_placeable_items[tile_names[int(tile)]] = p["tile_placeable_items"][tile].map(func(x): return item_names[int(x)])
			Global.hand_count = p["hand_count"]
			Global.hand_count_change.emit(Global.hand_count)

			Global.last_map_name = Global.current_map_name
			Global.current_map_name = p.metadata.name
			
			previously_in_lobby = in_lobby
			in_lobby = p.is_lobby
			debug_game_state("game-packet:game_data", {
				"mapName": p.metadata.name,
				"handCount": p["hand_count"],
				"itemNameCount": item_names.size(),
				"tileNameCount": tile_names.size(),
				"isLobby": in_lobby,
			})

			data_updated.emit()
		"add_player":
			var player_instance: Player
			if p.id == my_player_id:
				player_instance = ControllablePlayer.new(p.id, p.name, p.position, p.character, p.class, self)
				follow_camera.target = player_instance.movement_base
				follow_camera.reset()
				set_join_state(JoinState.JOINED)
				if Cli.opts.has("join-command"):
					mp.send_chat(my_player_id, Cli.opts["join-command"])
					Cli.opts.erase("join-command")
				if in_lobby:
					start_tutorial_maybe("map-selector")
			else:
				player_instance = Player.new(p.id, p.name, p.position, p.character, p.class, self)
			players[p.id] = player_instance
			add_child(player_instance)
			update_players.emit(players)
			debug_game_state("game-packet:add_player", {
				"playerId": p.id,
				"isLocalPlayer": p.id == my_player_id,
				"playerClass": p["class"],
				"position": p.position,
				"playerCount": players.size(),
			})
		"remove_player":
			var player: Player = players.get(p.id)
			if player == null:
				return
			if player.is_customer and player.current_item_message != null:
				tutorial_queue.erase(player.current_item_message)
			overlay_pinned_messages.clear_item(p.id)
			if p.id == my_player_id:
				set_join_state(JoinState.SPECTATING)
				follow_camera.target = $Center
			for h in player.hand:
				if h != null:
					h.queue_free()
			players.erase(p.id)
			player.is_despawning = true
			update_players.emit(players)
		"movement":
			if not players.has(p.player): return
			var player_instance: Player = players[p.player]
			player_instance.update_position(p.pos, p.dir, p.rot, p.boost)
			if p.player == my_player_id and p.get("sync"): player_instance.position_ = p.pos
		"move_item":
			var item: Item
			
			if "player" in p.from and "player" in p.to:
				item = players[p.from.player[0]].pass_to(players[p.to.player[0]], int(p.from.player[1]), int(p.to.player[1]))
			elif "tile" in p.from and "player" in p.to:
				var t: Tile = map.get_topmost_instance(p.from.tile)
				item = players[p.to.player[0]].take_item(t, int(p.to.player[1]))
			elif "player" in p.from and "tile" in p.to:
				var t: Tile = map.get_topmost_instance(p.to.tile)
				item = players[p.from.player[0]].put_item(t, int(p.from.player[1]))
			elif "tile" in p.from and "tile" in p.to:
				var from_tile2: Tile = map.get_topmost_instance(p.from.tile)
				var to_tile2: Tile = map.get_topmost_instance(p.to.tile)
				item = from_tile2.pass_to(to_tile2)
			
			# Tutorial for burned items
			if item != null:
				var item_name: String = item.item_name
				if "player" in p.to and p.to.player[0] == my_player_id and item_name.ends_with("burned"):
					start_tutorial_maybe("trash")
		"set_progress":
			if "tile" in p.item:
				var t: Tile = map.get_topmost_instance(p.item.tile)
				var acting_players: Array[Player] = []
				for id: float in p.players:
					if !players.has(id): continue
					acting_players.append(players[id])
				t.progress(p.position, p.speed, p.warn, acting_players)
			else:
				players[p.item.player[0]].progress(p.position, p.speed, p.warn, int(p.item.player[1]))
		"clear_progress":
			if "tile" in p.item:
				var t: Tile = map.get_topmost_instance(p.item.tile)
				t.finish()
			else:
				players[p.item.player[0]].finish(int(p.item.player[1]))
		"set_item":
			var location: Dictionary = p["location"]
			if p.item != null:
				if "tile" in p.location:
					var t: Tile = map.get_topmost_instance(p.location.tile)
					var i = ItemFactory.produce(item_names[p.item], t.item_base)
					i.animate_spawn()
					i.position = t.item_base.global_position
					i.rotation.y = t.item_base.global_rotation.y + PI
					i.position_target = i.position
					i.rotation_target = i.rotation.y
					add_child(i)
					i.name = item_names[p.item]
					t.set_item(i)
				else:
					var pl: Player = players[p.location.player[0]]
					var h = p.location.player[1]
					var i = ItemFactory.produce(item_names[p.item], pl.hand_base[h])
					i.animate_spawn()
					i.position = pl.hand_base[h].global_position
					i.rotation.y = pl.hand_base[h].global_rotation.y
					i.position_target = i.position
					i.rotation_target = i.rotation.y
					add_child(i)
					i.name = item_names[p.item]
					pl.set_item(i, h)
			else:
				if "tile" in p.location:
					var t: Tile = map.get_topmost_instance(p.location.tile)
					t.finish()
					t.set_item(null)
				else:
					var pl: Player = players[p.location.player[0]]
					var h = p.location.player[1]
					pl.finish(h)
					pl.set_item(null, h)
		"update_map":
			var changes: Dictionary[Vector2i, Array] = {} # Dictionary[Vector2i, Array[String]]
			for change in p["changes"]:
				var pos := Vector2i(change[0][0], change[0][1])
				var tiles: Array = change[1].map(func(x): return tile_names[int(x)] if x != null else null) # : Array[String]
				changes[pos] = tiles
			
			map.set_all_tiles(changes, server_context)
			map.flush()
			debug_game_state("game-packet:update_map", {
				"changeCount": changes.size(),
			})
		"communicate":
			# TODO: use MessageParser
			var timeout_initial: float = p.timeout.initial if p.timeout != null else 5.
			var timeout_remaining: float = p.timeout.remaining if p.timeout != null else 5.
			var pinned: bool = p.timeout.pinned if p.timeout != null and "pinned" in p.timeout else false
			if p.message != null:
				var m = MessageParser.new(p.message, self)
				match m.kind:
					MessageParser.Kind.ITEM:
						var item_name: String = m.result
						var container := ItemFactory.ItemName.new(item_name)
						var ingredients := [container.name]
						ingredients.append_array(container.contents)

						if pinned:
							overlay_pinned_messages.pin_item(item_name, timeout_initial, timeout_remaining, p.player)

						var player: Player = players[p.player]
						player.item_message(item_name, timeout_initial, timeout_remaining)

						if player.is_customer:
							start_tutorial_maybe(item_name, ingredients)
					MessageParser.Kind.TEXT:
						var data = TextMessage.new()
						data.timeout_initial = timeout_initial
						data.timeout_remaining = timeout_remaining
						if pinned:
							push_error("Pinned text messages are currently not supported")
						var player: Player = players[p.player]
						data.color = Character.COLORS[G.rem_euclid(player.character_style.color, Character.COLORS.size())]
						data.username = players[p.player].username
						data.text = m.result

						player.text_message(data)
						text_message.emit(data)
					_:
						push_error("unsupported communicate message type")
			else:
				var player: Player = players[p.player]
				if player.is_customer and player.current_item_message != null:
					tutorial_queue.erase(player.current_item_message)
				player.clear_text_message()
				player.clear_item_message()
				overlay_pinned_messages.clear_item(p.player)
		"effect":
			var target
			if "player" in p.location: target = players[p.location.player[0]].movement_base
			elif "tile" in p.location: target = map.get_topmost_instance(p.location.tile).base
			EffectFactory.play_effect(target, p)

		"set_ingame":
			overlay_score.set_ingame(p.state, in_lobby)
			follow_camera.set_ingame(p.state, in_lobby)
			debug_game_state("game-packet:set_ingame", {
				"state": p.state,
				"inLobby": in_lobby,
				"joinState": join_state,
			})

			if p.state:
				reset_camera()
				map.flush()
				await get_parent()._menu_open()
				map.autoflush = true
				
				if not is_replay and not Global.using_touch and not join_state == JoinState.SPECTATING:
					var using_joypad: bool = Global.using_joypad
					var two_handed: bool = Global.hand_count >= 2
					var profile_name: String = "controls_%s_%s_handed_explained" % [("joypad" if using_joypad else "keyboard"), ("two" if two_handed else "one")]
					if not Profile.read(profile_name):
						await menu.submenu("res://gui/overlays/controls_visualization/explanation.tscn", [profile_name, using_joypad, two_handed])
						Profile.write(profile_name, true)
				mp.send_ready()
			else:
				map.autoflush = false
				await get_parent()._menu_exit()
			
			if join_state == JoinState.SPECTATING:
				if in_lobby and not previously_in_lobby:
					toggle_join()
				elif not is_replay:
					menu.submenu("res://gui/menus/ingame.tscn")
		"score":
			if p.time_remaining != null:
				overlay_score.update(p.demands_failed, p.demands_completed, p.points, p.time_remaining)
				debug_game_state("game-packet:score", {
					"points": p.points,
					"timeRemaining": p.time_remaining,
				})
		"tutorial_ended":
			if p.player != my_player_id: return
			
			tutorial_running = false
			update_tutorial_running.emit(tutorial_running)
			
			if p.success:
				if "item" in p:
					var completed_item := ItemFactory.ItemName.new(item_names[p.item])
					completed_item.contents.append(completed_item.name)
					Profile.add_tutorial_ingredients_played(completed_item.contents)
					
					while item_names[p.item] in tutorial_queue:
						tutorial_queue.erase(item_names[p.item])
				if "tile" in p:
					var completed_tile: String = tile_names[p.tile]
					Profile.add_tutorial_ingredients_played([completed_tile])
				
				if not tutorial_queue.is_empty() and not Settings.read("gameplay.tutorial_disabled"):
					tutorial_running = true
					update_tutorial_running.emit(tutorial_running)
					mp.send_chat(my_player_id, "/start-tutorial %s" % tutorial_queue.pop_front())
			else:
				tutorial_queue.clear()
		"menu":
			match p.menu:
				"score":
					menu.submenu("res://gui/menus/rating/rating.tscn", [p.data.stars, p.data.points])
				"scoreboard":
					menu.submenu("res://gui/menus/scoreboard.tscn", p.data)
				"announce_start":
					overlay_announce_title.announce_start()
				"book":
					menu.submenu("res://gui/menus/book/book.tscn", BookMenu.BookData.new(self, p.data))
				"map_selector":
					menu.submenu("res://gui/menus/map_selector/map_selector.tscn", [maps, bot_algos])
				_:
					push_error("Received unrecognized menu type %s" % p.menu)
		"server_message":
			if p.error:
				overlay_popup_message.display_server_msg(tr("c.error.server").format([MessageParser.new(p.message, self).result]))
			else:
				overlay_popup_message.display_server_msg(MessageParser.new(p.message, self).result)
		"server_hint":
			if p.player != my_player_id: return
			
			var message = p.get("message")
			var position_ = p.get("position")
			
			if position_ == null:
				if message == null:
					overlay_popup_message.clear_server_hint()
				else:
					overlay_popup_message.display_server_hint(MessageParser.new(message, self).result)
			else:
				if message == null:
					overlay_popup_message.clear_server_hint(position_)
				else:
					overlay_popup_message.display_server_hint_positional(MessageParser.new(message, self).result, position_, false)
		"environment":
			$Environment.update(p.effects)
		"redirect":
			get_parent().replace_menu("res://gui/menus/game.tscn", p.uri[0])
		"disconnect":
			var m := MessageParser.new(p.reason, self)
			show_error(m.result)
		"replay_start":
			is_replay = true
		"replay_stop":
			if is_replay and OS.has_feature("movie"):
				menu.exit()
		"pause":
			overlay_score.set_paused(p.state)
			Global.game_paused = p.state
		"vote_started":
			overlay_vote.update(1, 0, 0)
			overlay_vote.start(
				MessageParser.new(p.message, self).result,
				players.get(p.initiated_by).username,
				p.timeout
			)
		"vote_updated":
			overlay_vote.update(p.total, p.agree, p.reject)
		"vote_ended":
			overlay_vote.end()
		"spectator_count":
			spectator_count = p.count
		"debug":
			pass # Only implemented in test client
		_:
			debug_game_state("game-packet:unrecognized", {
				"type": p.type,
			})
			push_warning("Unrecognized packet type: %s" % p.type)

func show_error(message: String):
	debug_game_state("game-show-error", {
		"message": message,
	})
	get_parent().replace_menu("res://gui/menus/error.tscn", [message, menu.data])

func system_message(s: String):
	var message = TextMessage.new()
	message.text = s
	message.color = Color.GOLD
	message.timeout_remaining = 5.
	text_message.emit(message)

func set_join_state(state: JoinState):
	join_state = state
	join_state_updated.emit(state)

func toggle_join():
	match join_state:
		JoinState.SPECTATING:
			set_join_state(JoinState.WAITING)
			mp.send_join(Settings.read("gameplay.username"), Profile.read("character_style"))
		JoinState.WAITING:
			push_error("Join/Leave action already toggled.")
		JoinState.JOINED:
			set_join_state(JoinState.WAITING)
			mp.send_leave(my_player_id)

func _process(delta):
	if not menu.covered:
		update_center()

	if is_replay and mp != null:
		mp.send_replay_tick(delta * float(Cli.opts.get("timescale", "1")))

func get_tile_collision(pos: Vector2i) -> bool:
	var t = map.get_tiles_at(pos)
	if t == null: return true
	else: return G.has_one(t, tile_collide)

func is_tile_interactive(pos: Vector2i, hands: Array) -> bool:
	var tiles = map.get_tiles_at(pos)
	if tiles == null: return false
	if map.get_tile_item(pos) != null: return true # We can pick up this item with our empty hand!
	for i in range(tiles.size() - 1, -1, -1):
		var tile: String = tiles[i]
		for hand in hands:
			if hand == null:
				if tile_interactable_empty.has(tile): return true
			else:
				if tile_placeable_any.has(tile): return true
				if tile_placeable_items.has(tile):
					return tile_placeable_items[tile].has(hand.item_name)
	return false

func reset_camera():
	var extents = map.extents()
	var map_center = ((extents[0] + extents[1]) / 2) + Vector2(.5, .5)
	$FollowCamera.reset()
	$Center.position = Vector3(map_center.x, 0., map_center.y)
	$FollowCamera.jump_to_target()
	$FollowCamera.camera_distance = 20.

func update_center():
	$FollowCamera.autozoom = spectating_mode == SpectatingMode.CENTER and join_state == JoinState.SPECTATING
	if join_state != JoinState.SPECTATING:
		return
	if Input.get_vector("left", "right", "forwards", "backwards").normalized().length() > .1:
		spectating_mode = SpectatingMode.FREE
	if Input.is_action_just_pressed("zoom_out_discrete") or Input.is_action_just_pressed("zoom_in_discrete"):
		spectating_mode = SpectatingMode.FREE
	if abs(Input.get_axis("zoom_in", "zoom_out")) > .1:
		spectating_mode = SpectatingMode.FREE
	elif spectating_mode == SpectatingMode.FREE and Input.is_action_just_pressed("reset"):
		spectating_mode = SpectatingMode.CENTER
	match spectating_mode:
		SpectatingMode.CENTER: spectate_center()
		SpectatingMode.FREE: spectate_free()

func spectate_center():
	var any_chefs = false
	for v in players.values():
		any_chefs = any_chefs or v.is_chef
	var no_chefs = not any_chefs

	var sum: int = 0
	var center: Vector3 = Vector3(0.,0.,0.)
	for p in players.values():
		if p.is_chef or no_chefs:
			sum += 1
			center += p.movement_base.position

	var bmin = Vector2.INF
	var bmax = -Vector2.INF
	for p in players.values():
		if p.is_chef or no_chefs:
			bmin.x = min(bmin.x, p.movement_base.position.x)
			bmin.y = min(bmin.y, p.movement_base.position.z)
			bmax.x = max(bmax.x, p.movement_base.position.x)
			bmax.y = max(bmax.y, p.movement_base.position.z)
	var extent = max(bmax.x - bmin.x, bmax.y - bmin.y)

	if sum > 0:
		$Center.position = center / sum
		$FollowCamera.camera_distance_target = max(extent * 2, 8)
	elif sum > 0:
		$Center.position = center / sum
		$FollowCamera.camera_distance_target = max(extent * 2, 8)
	else:
		var extents = map.extents()
		var map_center = ((extents[0] + extents[1]) / 2) + Vector2(.5, .5)
		$Center.position = Vector3(map_center.x, 0.,map_center.y)
		$FollowCamera.camera_distance_target = (extents[1] - extents[0]).length() / 2

func spectate_free():
	var direction := Input.get_vector("left", "right", "forwards", "backwards")
	direction = direction.rotated(-follow_camera.angle_target)
	$Center.position += Vector3(
		direction.x,
		$Center.position.y,
		direction.y
	) * get_process_delta_time() * 10.
	var extents = map.extents()
	$Center.position.x = clamp($Center.position.x, extents[0].x, extents[1].x)
	$Center.position.z = clamp($Center.position.z, extents[0].y, extents[1].y)

func start_tutorial_maybe(item: String, ingredients: Array = [item], use_queue := true):
	if (not Settings.read("gameplay.tutorial_disabled")
		and join_state == JoinState.JOINED):
		var completed_ingredients: Array = Profile.read("tutorial_ingredients_played")
		if Global.array_has_all(completed_ingredients, ingredients): return
		if tutorial_running:
			if use_queue:
				tutorial_queue.push_back(item)
		else:
			tutorial_running = true
			update_tutorial_running.emit(tutorial_running)
			mp.send_chat(my_player_id, "/start-tutorial %s" % item)
