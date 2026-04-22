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
class_name Entry
extends Menu

const LOCAL_BRIDGE_URL := "forkorfry-local://bootstrap"

func update_forkorfry_bridge_state(state: String, extra: Dictionary = {}):
	if not OS.has_feature("web"):
		return

	var console = JavaScriptBridge.get_interface("console")
	if console != null:
		console.log("ForkOrFry entry state", state, JSON.stringify(extra))

	var state_json = JSON.stringify(state)
	var payload_json = JSON.stringify(extra)
	JavaScriptBridge.eval("""
		(function () {
			window.__FORKORFRY_GODOT_ENTRY_STATE__ = %s;
			window.__FORKORFRY_GODOT_ENTRY_EXTRA_JSON__ = %s;
			window.__FORKORFRY_GODOT_LAST_UPDATE__ = 'entry';
			var current = window.__FORKORFRY_GODOT_BRIDGE__ || {};
			current.entryState = %s;
			current.entryUpdatedAt = new Date().toISOString();
			var extra = %s || {};
			for (var key in extra) current[key] = extra[key];
			window.__FORKORFRY_GODOT_BRIDGE__ = current;
			window.__FORKORFRY_GODOT_BRIDGE_JSON__ = JSON.stringify(current);
		}());
	""" % [state_json, payload_json, state_json, payload_json])

func _ready():
	update_forkorfry_bridge_state("entry-ready:start")
	GLTFDocument.register_gltf_document_extension(GLTFApplyNodeVisibility.new())
	TranslationManager.load_locales()
	Settings.load(OS.get_config_dir().path_join("hurrycurry").path_join("settings.json"))
	super() # Must be called after settings load

	if not Cli.init(): 
		update_forkorfry_bridge_state("entry-ready:cli-failed")
		get_tree().quit()
		return

	if Cli.opts.has("render-items") or Cli.opts.has("render-tiles"):
		await submenu("res://system/render_tool.tscn")

	var local_bridge_bootstrap := has_forkorfry_bootstrap()
	Profile.load(OS.get_data_dir().path_join("hurrycurry").path_join("profile"))
	get_viewport().gui_focus_changed.connect(Sound.play_hover_maybe)
	ModLoader.init()
	if local_bridge_bootstrap:
		update_forkorfry_bridge_state("entry-ready:skip-services", {
			"reason": "local-bridge-bootstrap",
		})
	else:
		Editor.init()
		Server.init()
		Discover.init()

	if local_bridge_bootstrap:
		update_forkorfry_bridge_state("entry-ready:local-bootstrap", {
			"entryRoute": LOCAL_BRIDGE_URL,
		})
		await submenu("res://gui/menus/game.tscn", [LOCAL_BRIDGE_URL])
	elif Cli.opts.has("connect_address"):
		update_forkorfry_bridge_state("entry-ready:cli-connect", {
			"entryRoute": str(Cli.opts["connect_address"]),
		})
		var urls: Array[String] = [Cli.opts["connect_address"]]
		await submenu("res://gui/menus/game.tscn", urls)
	elif not Settings.read("gameplay.setup_completed") or Settings.read("gameplay.username").is_empty():
		update_forkorfry_bridge_state("entry-ready:setup")
		await submenu("res://gui/menus/setup/setup.tscn")
	else:
		update_forkorfry_bridge_state("entry-ready:main-menu")
		await submenu("res://gui/menus/main/main.tscn")

	update_forkorfry_bridge_state("entry-ready:menu-stack-empty")
	print("Menu stack empty, quitting game.")
	get_tree().quit()

func quit():
	pass

func has_forkorfry_bootstrap() -> bool:
	if not OS.has_feature("web"):
		return false

	var payload_json = JavaScriptBridge.eval("JSON.stringify(window.__FORKORFRY_BOOT__ ?? null)")
	if payload_json == null or payload_json == "null":
		update_forkorfry_bridge_state("entry-bootstrap:missing")
		return false

	var payload = JSON.parse_string(payload_json)
	if not payload is Dictionary:
		update_forkorfry_bridge_state("entry-bootstrap:invalid-json")
		return false

	var valid = payload.get("type") == "forkorfry:local-bootstrap"
	update_forkorfry_bridge_state(
		"entry-bootstrap:%s" % ("detected" if valid else "invalid-type"),
		{
			"bootstrapType": str(payload.get("type", "")),
			"bootstrapSessionId": str(payload.get("sessionId", "")),
			"bootstrapPacketCount": payload.get("packets", []).size() if payload.get("packets") is Array else -1,
		},
	)
	return valid
