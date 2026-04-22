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
extends Node
class_name TranslationManager

const LOCALE_PATH := "res://locale/"
const NATIVE_LANGUAGE_NAMES_FILE_NAME := "native_language_names.ini1"

static var LOCALE_STATS = {}

static func load_locales() -> void:
	if not DirAccess.dir_exists_absolute(LOCALE_PATH):
		push_warning("Locale directory missing: %s" % LOCALE_PATH)
		return

	# Use english as fallback
	var native_language_names := get_ini_dict(NATIVE_LANGUAGE_NAMES_FILE_NAME, LOCALE_PATH)
	var fallback_strings := get_ini_dict("en.ini", LOCALE_PATH)

	for file_name in DirAccess.get_files_at(LOCALE_PATH):
		if !file_name.ends_with(".ini"):
			continue

		var translation := Translation.new()
		translation.locale = file_name.trim_suffix(".ini")
		var strings := get_ini_dict(file_name, LOCALE_PATH)
		
		var strings_total = fallback_strings.size()
		var strings_found = 0
		for k in fallback_strings.keys():
			translation.add_message(k, strings[k] if strings.has(k) else fallback_strings[k])
			if strings.has(k): strings_found += 1
		for k in native_language_names.keys():
			translation.add_message("c.settings.ui.language.%s" % k, native_language_names[k])

		LOCALE_STATS[translation.locale] = float(strings_found) / float(strings_total)
		TranslationServer.add_translation(translation)

static func get_ini_dict(file_name: String, locale_path: String) -> Dictionary: # Dictionary[String, String]
	var dict := {}
	var lines := FileAccess.get_file_as_string(locale_path + file_name).split("\n", false)
	
	for line in lines:
		if line.length() == 0 or line == "[hurrycurry]": continue
		var halves := line.split("=", true, 1)
		dict[halves[0].strip_edges()] = halves[1].strip_edges().replace("%n", "\n")
	
	return dict
