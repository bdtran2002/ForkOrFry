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
extends Menu
class_name GameMenu

const LOCAL_BRIDGE_URL := "forkorfry-local://bootstrap"

@onready var game: Game = $Game
@onready var overlays: Overlays = $Overlays
@onready var popup_message: PopupMessage = $Overlays/PopupMessage
@onready var chat_preview: ChatPreview = $Overlays/ChatPreview
@onready var pinned_items: PinnedItemMessages = $Overlays/VBox/PinnedMessages

func debug_game_menu_state(state: String, extra: Dictionary = {}):
	if not OS.has_feature("web"):
		return

	var console = JavaScriptBridge.get_interface("console")
	if console != null:
		console.log("ForkOrFry game menu state", state, JSON.stringify(extra))

func _ready():
	debug_game_menu_state("game-menu:ready", {
		"data": data,
	})
	get_tree().get_root().go_back_requested.connect(open_ingame_menu)
	super()
	transition.set_loading_text(tr("c.menu.game.connecting"))
	if data is Array and data.size() > 0 and data[0] == LOCAL_BRIDGE_URL:
		call_deferred("ensure_local_bridge_connect")

func ensure_local_bridge_connect():
	await get_tree().process_frame
	debug_game_menu_state("game-menu:ensure-local-bridge", {
		"data": data,
		"mpConnected": game.mp.connected,
		"myPlayerId": game.my_player_id,
	})
	if game.mp.connected:
		return
	var urls: Array[String] = [LOCAL_BRIDGE_URL]
	debug_game_menu_state("game-menu:calling-connect", {
		"urls": urls,
	})
	game.mp.connect_to_urls(urls)

func _input(_event):
	if Input.is_action_just_pressed("ui_menu"):
		open_ingame_menu()

	if Input.is_action_just_pressed("chat"):
		Sound.play_click()
		chat_preview.visible = false
		await submenu("res://gui/menus/chat.tscn")
		chat_preview.visible = true
	
	if Input.is_action_just_pressed("screenshot"):
		var path = get_shot_path("screenshot-%s.png")
		var err = get_viewport().get_texture().get_image().save_png(path)
		if err != OK: game.system_message("Could not save screenshot to %s (%d)" % [path, err])
		else: game.system_message(tr("c.system_message.screenshot_saved").format({"path": path}))

	if Input.is_action_just_pressed("sceneshot"):
		var path = get_shot_path("sceneshot-%s.glb")
		var doc := GLTFDocument.new()
		var state := GLTFState.new()
		doc.append_from_scene(game, state)
		var err = doc.write_to_filesystem(state, path)
		if err != OK: game.system_message("Could not save scenenshot to %s (%d)" % [path, err])
		else: game.system_message(tr("c.system_message.sceneshot_saved").format({"path": path}))

	if Input.is_action_just_pressed("toggle_first_person"):
		Settings.write("gameplay.first_person", not Settings.read("gameplay.first_person"))

func get_shot_path(template: String) -> String:
	var path = Settings.read("gameplay.screenshot_path")
	if path == "": path = "user://"
	var filename = template % Time.get_datetime_string_from_system()
	return "%s/%s" % [path, filename]

func _menu_open():
	await super()
	if Settings.read("input.capture_mouse"):
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _menu_cover(state):
	super(state)
	overlays.visible = not state
	game.mp.send_idle(state)
	game.follow_camera._disable_input = state
	if Settings.read("input.capture_mouse"):
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if not covered else Input.MOUSE_MODE_VISIBLE

func _menu_exit():
	await super()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _menu_music(): Sound.set_music(null)

func open_ingame_menu():
	if popup != null: return
	Sound.play_click()
	submenu("res://gui/menus/ingame.tscn")
