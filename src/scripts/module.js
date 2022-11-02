import { setApi } from "../main.js";
import "./api.js";
import API from "./api.js";
import CONSTANTS from "./constants.js";
import { renderDialogFinalBlow } from "./lib/lib.js";
import { advancedMacroSocket, registerSocket } from "./socket.js";

export const initHooks = () => {
	let helpers = {
		macro: (name, ...args) => {
			const macro = game.macros.contents.find((macro) => macro.name === name);
			if (!macro) return "";
			const result = macro.renderContent(...args);
			if (typeof result !== "string") return "";
			return result;
		},
	};
	Handlebars.registerHelper(helpers);

	// new HandlebarHelpers().registerHelpers();
	Hooks.once("socketlib.ready", registerSocket);
	registerSocket();

	Hooks.on("chatMessage", API.chatMessage);

	libWrapper.register(
		"advanced-macros",
		"Macro.prototype.renderContent",
		async function (wrapped, ...args) {
			const context = API.getTemplateContext(args);
			if (this.type === "chat") {
				if (this.command.includes("{{")) {
					const compiled = Handlebars.compile(this.command);
					return compiled(context, {
						allowProtoMethodsByDefault: true,
						allowProtoPropertiesByDefault: true,
					});
				} else {
					return this.command;
				}
			}
			if (this.type === "script") {
				if (!game.user.can("MACRO_SCRIPT")) {
					return ui.notifications.warn(game.i18n.localize("advanced-macros.MACROS.responses.NoMacroPermission"));
				}
				if (this.getFlag("advanced-macros", "runAsGM") && API.canRunAsGM(this) && !game.user.isGM) {
					if (this.getFlag("advanced-macros", "runForEveryone")) {
						return await advancedMacroSocket.executeForEveryone("executeMacro", this.id, game.user.id, undefined, context);
					}
					return await advancedMacroSocket.executeAsGM(this, context);
				} else if (this.getFlag("advanced-macros", "runForEveryone") && API.canRunAsGM(this) && !game.user.isGM) {
					return await advancedMacroSocket.executeForEveryone("executeMacro", this.id, game.user.id, undefined, context);
				}
				// return this.callScriptFunction(context);
				return this._executeScript(context);
			}
		},
		"OVERRIDE"
	);

	libWrapper.register(
		"advanced-macros",
		"Macro.prototype.canExecute",
		function (wrapped, ...args) {
			if (!this.testUserPermission(game.user, "LIMITED")) {
				return false;
			}
			if (this.type === "script") {
				if (this.getFlag("advanced-macros", "runAsGM") && API.canRunAsGM(this) && !game.user.isGM) {
					return true;
				}
				return game.user.can("MACRO_SCRIPT");
			}
			return true;
		},
		"OVERRIDE"
	);

	libWrapper.register(
		"advanced-macros",
		"Macro.prototype._executeScript",
		function (wrapped, ...args) {
			return API.executeScript(wrapped, ...args);
		},
		"OVERRIDE"
	);

	libWrapper.register("advanced-macros", "Macro.prototype.execute", API.executeMacro, "OVERRIDE");
	if (game.system.id === "pf2e") {
		libWrapper.register(
			"advanced-macros",
			"CONFIG.Macro.documentClass.prototype._executeScript",
			function (wrapped, ...args) {
				return API.executeScript(wrapped, ...args);
			},
			"OVERRIDE"
		);
	}
};
export const setupHooks = () => {
	setApi(API);
};
export const readyHooks = async () => {
	Hooks.once("renderMacroConfig", (obj, html, data) => {
		API.renderMacroConfig(obj, html, data);
	});
};
// ==========================================
