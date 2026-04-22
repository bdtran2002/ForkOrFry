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
class_name Service
extends Node


func name():
	return "Unknown"
func arguments():
	return []
func exe_path():
	return "false"
func test_port():
	return 25565
func test_host():
	return "127.0.0.1"


var thread = null
var pid = null

var state = State.UNAVAILABLE
enum State {
	TESTING,
	UNAVAILABLE,
	FAILED,
	STOPPED,
	STARTING,
	RUNNING,
}

var sem = Semaphore.new()
var thread_result = null

func _ready():
	if OS.has_feature("web"):
		state = State.UNAVAILABLE
		thread = null
		thread_result = null
		set_process(false)
		update_service_debug("service-ready:disable-web", {})

func update_service_debug(state_name: String, extra: Dictionary = {}):
	if not OS.has_feature("web"):
		return

	var console = JavaScriptBridge.get_interface("console")
	if console != null:
		console.log("ForkOrFry service state", name(), state_name, JSON.stringify(extra))

func init():
	if OS.has_feature("web"):
		state = State.UNAVAILABLE
		thread = null
		thread_result = null
		update_service_debug("service-init:skip-web", {})
		return

	state = State.TESTING
	thread = Thread.new()
	thread.start(_test_server)

func test():
	pass

func start():
	if state != State.STOPPED and state != State.FAILED:
		push_error(name() + " can't be started")
		return
	print(name() + ": Starting...")
	state = State.STARTING
	thread = Thread.new()
	thread.start(_server_exec)

func stop():
	if state != State.RUNNING:
		push_error(name() + " can't be stopped")
		return
	print(name() + ": Stopping...")
	OS.kill(pid)

func _test_server():
	var output = []
	print(name() + ": Testing executable " + exe_path())
	thread_result = OS.execute(exe_path(), ["-v"], output, true, false)
	print(name() + ": Version = " + output[0].strip_edges())
	sem.post()

func _server_exec():
	var args = arguments()
	thread_result = OS.create_process(exe_path(), args, false)
	if thread_result >= 0:
		var ok = false
		while not ok:
			var conn = StreamPeerTCP.new()
			if conn.connect_to_host(test_host(), test_port()) == OK:
				while conn.poll() == OK:
					if conn.get_status() == StreamPeerTCP.STATUS_ERROR: break
					elif conn.get_status() == StreamPeerTCP.STATUS_CONNECTED: ok = true; break
					OS.delay_msec(10)
			OS.delay_msec(500 if not ok else 50)
			if !OS.is_process_running(thread_result):
				thread_result = -1
				break
	sem.post()

func _process(_delta):
	if OS.has_feature("web"):
		return

	match state:
		State.TESTING:
			if sem.try_wait():
				print(name() + ": Test result=", thread_result)
				if thread_result == 0: state = State.STOPPED
				else: state = State.UNAVAILABLE
				thread.wait_to_finish()
				thread = null
		State.STARTING:
			if sem.try_wait():
				if thread_result >= 0:
					state = State.RUNNING
					pid = thread_result
					print(name() + ": Started pid=", thread_result)
				else:
					state = State.FAILED
					print(name() + ": Failed")
				thread.wait_to_finish()
				thread = null
		State.RUNNING:
			if not OS.is_process_running(pid):
				print(name() + ": Stopped")
				state = State.STOPPED
				pid = null

func _exit_tree():
	if state == State.RUNNING: stop()
	if thread != null: thread.wait_to_finish()
