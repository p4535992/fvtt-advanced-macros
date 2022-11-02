import { error } from "console";
import { advancedMacroSocket } from "./socket";

const API = {

    // async GMElectionIDArr(...inAttributes) {
    //     if (!Array.isArray(inAttributes)) {
    //       throw error('GMElectionIDArr | inAttributes must be of type array');
    //     }
    //     await this.GMElectionID(inAttributes);
    // },

    // async GMMacroResultArr(...inAttributes) {
    //     if (!Array.isArray(inAttributes)) {
    //       throw error('GMMacroResultArr | inAttributes must be of type array');
    //     }
    //     await this.GMMacroResult(inAttributes);
    // },

    // async ElectGMExecutorArr(...inAttributes) {
    //     if (!Array.isArray(inAttributes)) {
    //       throw error('ElectGMExecutorArr | inAttributes must be of type array');
    //     }
    //     return await this.ElectGMExecutor(inAttributes);
    // },

    // async GMExecuteMacroArr(...inAttributes) {
    //     if (!Array.isArray(inAttributes)) {
    //       throw error('GMExecuteMacro | inAttributes must be of type array');
    //     }
    //     return await this.GMExecuteMacro(inAttributes);
    // },

    async executeMacroArr(...inAttributes) {
        if (!Array.isArray(inAttributes)) {
          throw error('GMExecuteMacro | inAttributes must be of type array');
        }
        const [macroId, userId, args, context] = inAttributes;
        return await this.executeMacro(macroId, userId, args, context);
    },

    async executeMacro(macroId, userId, args, context) {
        const macro = game.macros.get(macroId);
        const user = game.users.get(userId);

        if (!macro) {
            throw error(game.i18n.localize("advanced-macros.MACROS.responses.NoMacro"), true)
        }
        if (!user) {
            throw error(game.i18n.localize("advanced-macros.MACROS.responses.NoUser"), true);
        }
        if (macro.type !== "script") {
            throw error(game.i18n.localize("advanced-macros.MACROS.responses.NotScript"), true);
        }
        if (!user.can("MACRO_SCRIPT")) {
            throw error(game.i18n.localize("advanced-macros.MACROS.responses.NoMacroPermission"), true);
        }
        if (!macro.getFlag("advanced-macros", "runAsGM") || !this.canRunAsGM(macro)) {
            throw error(game.i18n.localize("advanced-macros.MACROS.responses.NoRunAsGM"), true);
        }

        const contextFinal = this.getTemplateContext(args, context);
        try {
            // const result = macro.callScriptFunction(context);
            const result = macro._executeScript(contextFinal);
            return result;
        } catch (err) {
            error(err);
            throw error(game.i18n.format("advanced-macros.MACROS.responses.ExternalMacroSyntaxError", { GM: game.user.name }), true);
        }
    },

    executeScript(wrapped, ...args) {
        const [context] = args;
        // Add variables to the evaluation scope
        const speaker = ChatMessage.implementation.getSpeaker();
        const character = game.user.character;
        let actor = context.actor || game.actors.get(context.speaker.actor);
        let token = context.token || (canvas.ready ? canvas.tokens.get(context.speaker.token) : null);

        // Attempt script execution
        const asyncFunction = this.command.includes("await") ? "async" : "";
        const body = `return (${asyncFunction} () => {
        ${this.command}
    })()`;
        // eslint-disable-next-line no-new-func
        const fn = Function("{speaker, actor, token, character, args, scene}={}", body);
        try {
            return fn.call(this, context);
        } catch (err) {
            // ui.notifications.error("There was an error in your macro syntax. See the console (F12) for details", {
            //     console: false,
            // });
            // console.error("Advanced Macros |", err);
            error("There was an error in your macro syntax. See the console (F12) for details : " + err, true);
        }
        return wrapped(...args);
    },

	getTemplateContext(args = null, remoteContext = null) {
		const context = {
			game: game,
			ui: ui,
			canvas: canvas,
			scene: canvas.scene,
			args,
			speaker: {},
			actor: null,
			token: null,
			character: null,
		};
		if (remoteContext) {
			// Set the context based on the remote context, and make sure data is valid and the remote
			// has a token/actor selected.
			context.speaker = remoteContext.speaker || {};
			if (remoteContext.actorId) context.actor = game.actors.get(remoteContext.actorId) || null;
			if (remoteContext.sceneId) context.scene = game.scenes.get(remoteContext.sceneId) || canvas.scene;
			if (remoteContext.tokenId) {
				if (canvas.scene.id === context.scene.id) {
					context.token = canvas.tokens.get(remoteContext.tokenId) || null;
				} else {
					const tokenData = context.scene.getEmbeddedEntity("Token", remoteContext.tokenId);
					if (tokenData) context.token = new Token(tokenData, context.scene);
				}
			}
			if (remoteContext.characterId) context.character = game.actors.get(remoteContext.characterId) || null;
		} else {
			context.speaker = ChatMessage.getSpeaker();
			if (args && Object.prototype.toString.call(args[0]) === "[object Object") {
				context.actor = args[0].data.root.actor;
				context.token = args[0].data.root.token;
			} else {
				context.actor = game.actors.get(context.speaker.actor);
				if (canvas.scene) context.token = canvas.tokens?.get(context.speaker.token);
			}
			context.character = game.user.character;
		}
		return context;
	},

	/**
	 * Defines whether a Macro can run as a GM.
	 * For security reasons, only macros authored by the GM, and not editable by users
	 * can be run as GM
	 */
    canRunAsGM(macro) {
		const author = game.users.get(macro.author?.id);
		const permissions = duplicate(macro.permission) || {};
		game.users.contents.forEach((user) => {
			if (user.id === macro.author?.id || user.isGM) {
                delete permissions[user.id];
            }
		});
		return author && author.isGM && Object.values(permissions).every((p) => p < CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
	},

	async renderMacro(wrapped, ...args) {
		const context = this.getTemplateContext(args);
		if (this.type === "chat") {
			if (this.command.includes("{{")) {
				const compiled = Handlebars.compile(this.command);
				return compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true });
			} else {
				return this.command;
			}
		}
		if (this.type === "script") {
			if (!game.user.can("MACRO_SCRIPT")) {
                return ui.notifications.warn(game.i18n.localize("advanced-macros.MACROS.responses.NoMacroPermission"));
            }
			if (this.getFlag("advanced-macros", "runAsGM") && this.canRunAsGM() && !game.user.isGM) {
                // return game.furnaceMacros.executeMacroAsGM(this, context);
                return await advancedMacroSocket.executeMacroAsGM("executeMacro", this.id, game.user.id, undefined, context);
            }
			// return this.callScriptFunction(context);
			return this._executeScript(context);
		}
        return wrapped(...args);
	},

    // async executeMacro(...args) {
    //     const [macroId, userId, context] = args;

    //     const macro = game.macros.get(macroId);
    //     const user = game.users.get(userId);

    //     // const sendResponse = (error = null, result = null) =>
    //     //     game.socket.emit("module.advanced-macros", {
    //     //         action: "GMMacroResult",
    //     //         requestId: message.requestId,
    //     //         error,
    //     //     });

    //     if (!macro) {
    //         // return sendResponse(game.i18n.localize("advanced-macros.MACROS.responses.NoMacro"));
    //         // return {
    //         //     action: "GMMacroResult",
    //         //     requestId: message.requestId,
    //         //     error: game.i18n.localize("advanced-macros.MACROS.responses.NoMacro"),
    //         // };
    //         throw error(game.i18n.localize("advanced-macros.MACROS.responses.NoMacro"), true)
    //     }
    //     if (!user) {
    //         // return sendResponse(game.i18n.localize("advanced-macros.MACROS.responses.NoUser"));
    //         // return {
    //         //     action: "GMMacroResult",
    //         //     requestId: message.requestId,
    //         //     error: game.i18n.localize("advanced-macros.MACROS.responses.NoUser"),
    //         // };
    //         throw error(game.i18n.localize("advanced-macros.MACROS.responses.NoUser"), true);
    //     }
    //     if (macro.type !== "script") {
    //         // return sendResponse(game.i18n.localize("advanced-macros.MACROS.responses.NotScript"));
    //         // return {
    //         //     action: "GMMacroResult",
    //         //     requestId: message.requestId,
    //         //     error: game.i18n.localize("advanced-macros.MACROS.responses.NotScript"),
    //         // };
    //         throw error(game.i18n.localize("advanced-macros.MACROS.responses.NotScript"), true);
    //     }
    //     if (!user.can("MACRO_SCRIPT")) {
    //         // return sendResponse(game.i18n.localize("advanced-macros.MACROS.responses.NoMacroPermission"));
    //         // return {
    //         //     action: "GMMacroResult",
    //         //     requestId: message.requestId,
    //         //     error: game.i18n.localize("advanced-macros.MACROS.responses.NoMacroPermission"),
    //         // };
    //         throw error(game.i18n.localize("advanced-macros.MACROS.responses.NoMacroPermission"), true);
    //     }
    //     if (!macro.getFlag("advanced-macros", "runAsGM") || !macro.canRunAsGM) {
    //         // return sendResponse(game.i18n.localize("advanced-macros.MACROS.responses.NoRunAsGM"));
    //         // return {
    //         //     action: "GMMacroResult",
    //         //     requestId: message.requestId,
    //         //     error: game.i18n.localize("advanced-macros.MACROS.responses.NoRunAsGM"),
    //         // };
    //         throw error(game.i18n.localize("advanced-macros.MACROS.responses.NoRunAsGM"), true);
    //     }

    //     // Chat macros
	// 	if (macro.type === "chat") {
	// 		try {
	// 			const content = macro.renderContent(...args);
	// 			ui.chat.processMessage(content).catch((err) => {
	// 				// ui.notifications.error(game.i18n.localize("advanced-macros.MACROS.responses.SyntaxError"), { console: false });
	// 				// console.error("Advanced Macros |", err);
    //                 error(game.i18n.localize("advanced-macros.MACROS.responses.SyntaxError") + " : " + err, true);
	// 			});
	// 		} catch (err) {
	// 			// ui.notifications.error(game.i18n.localize("advanced-macros.MACROS.responses.MacroSyntaxError"), { console: false });
	// 			// console.error("Advanced Macros |", err);
    //             error(game.i18n.localize("advanced-macros.MACROS.responses.MacroSyntaxError") + " : " + err, true);
	// 		}
	// 	}

	// 	// Script macros
	// 	else if (macro.type === "script") {
	// 		try {
	// 			return await macro.renderContent(...args);
	// 		} catch (err) {
	// 			// ui.notifications.error(game.i18n.localize("advanced-macros.MACROS.responses.MacroSyntaxError"), { console: false });
	// 			// console.error("Advanced Macros |", err);
    //             error(game.i18n.localize("advanced-macros.MACROS.responses.MacroSyntaxError") + " : " + err, true);
	// 		}
	// 	}
    // },

	chatMessage(chatLog, message, chatData) {
		let tokenizer = null;
		let hasMacros = false;
		if (message.includes("{{")) {
			const context = FurnaceMacros.getTemplateContext();
			const compiled = Handlebars.compile(message);
			message = compiled(context, { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true });
			if (message.trim().length === 0) return false;
			message = message;
		}
		if (message.trim().startsWith("<")) return true;
		if (message.match(chatLog.constructor.MESSAGE_PATTERNS["invalid"])) {
			message = message.replace(/\n/gm, "<br>");
			message = message.split("<br>").map((line) => {
				if (line.startsWith("/")) {
					// Ensure tokenizer, but don't consider dash as a token delimiter
					if (!tokenizer)
						tokenizer = new TokenizeThis({
							shouldTokenize: ["(", ")", ",", "*", "/", "%", "+", "=", "!=", "!", "<", ">", "<=", ">=", "^"],
						});
					let command = null;
					let args = [];
					tokenizer.tokenize(line.substr(1), (token) => {
						if (!command) command = token;
						else args.push(token);
					});
					const macro = game.macros.contents.find((macro) => macro.name === command);
					if (macro) {
						hasMacros = true;
						const result = macro.renderContent(...args);
						if (typeof result !== "string") return "";
						return result.trim();
					}
				}
				return line.trim();
			});

			message = message.join("\n").trim().replace(/\n/gm, "<br>");
			if (hasMacros) {
				// If non-async, then still, recreate it so we can do recursive macro calls
				if (message !== undefined && message.length > 0) {
					message = message.trim();

					let [command, match] = ChatLog.parse(message);
					// Process message data based on the identified command type
					const createOptions = {};
					const data = {
						content: message,
						...chatData,
					};
					switch (command) {
						case "whisper":
						case "reply":
						case "gm":
						case "players":
							ChatLog.prototype._processWhisperCommand(command, match, data, createOptions);
							break;
						case "none":
							command = chatData.speaker?.token ? "ic" : "ooc";
						case "ic":
						case "emote":
						case "ooc":
							ChatLog.prototype._processChatCommand(command, match, data, createOptions);
							break;
						case "invalid":
							throw new Error(game.i18n.format("CHAT.InvalidCommand", { command: match[1] }));
					}
					ChatMessage.create(data, createOptions);
				}
				return false;
			}
		}
		return true;
	},

	renderMacroConfig(obj, html, data) {
		let form = html.find("form");
		// A re-render will cause the html object to be the internal element, which is the form itself.
		if (form.length === 0) {
            form = html;
        }
		// Add runAsGM checkbox
		if (game.user.isGM) {
			const runAsGM = obj.object.getFlag("advanced-macros", "runAsGM");
			const canRunAsGM = this.canRunAsGM(obj.object);
			const typeGroup = form.find("select[name=type]").parent(".form-group");
			const gmDiv = $(`
				<div class="form-group" title="${game.i18n.localize("advanced-macros.MACROS.runAsGMTooltip")}">
					<label class="form-group">
						<span>${game.i18n.localize("advanced-macros.MACROS.runAsGM")}</span>
						<input type="checkbox" name="flags.advanced-macros.runAsGM" data-dtype="Boolean" ${runAsGM ? "checked" : ""} ${!canRunAsGM ? "disabled" : ""}/>
					</label>
				</div>
			`);
			gmDiv.insertAfter(typeGroup);

            // Execute for all other clients (ty to socketlib)

            // const runForEveryone = app.object.getFlag("advanced-macros", "runForEveryone");
            // const everyoneDiv = $(`
            // <div class="form-group" title="${game.i18n.localize("advanced-macros.MACROS.runForEveryoneTooltip")}">
            //         <label class="form-group">
            //             <span>${game.i18n.localize("advanced-macros.MACROS.runForEveryone")}</span>
            //             <input type="checkbox" name="flags.advanced-macros.runForEveryone" data-dtype="Boolean" ${runForEveryone ? "checked" : ""} ${!canRunAsGM ? "disabled" : ""}>
            //         </label>
            // </div>
            // `);

            // everyoneDiv.insertAfter(checkbox);
		}
	}
};
export default API;
