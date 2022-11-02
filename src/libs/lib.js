import CONSTANTS from "../constants.js";
import { finalBlowSocket } from "../socket.js";

// ================================
// Logger utility
// ================================
// export let debugEnabled = 0;
// 0 = none, warnings = 1, debug = 2, all = 3
export function debug(msg, args = "") {
	if (game.settings.get(CONSTANTS.MODULE_NAME, "debug")) {
		console.log(`DEBUG | ${CONSTANTS.MODULE_NAME} | ${msg}`, args);
	}
	return msg;
}
export function log(message) {
	message = `${CONSTANTS.MODULE_NAME} | ${message}`;
	console.log(message.replace("<br>", "\n"));
	return message;
}
export function notify(message) {
	message = `${CONSTANTS.MODULE_NAME} | ${message}`;
	ui.notifications?.notify(message);
	console.log(message.replace("<br>", "\n"));
	return message;
}
export function info(info, notify = false) {
	info = `${CONSTANTS.MODULE_NAME} | ${info}`;
	if (notify) ui.notifications?.info(info);
	console.log(info.replace("<br>", "\n"));
	return info;
}
export function warn(warning, notify = false) {
	warning = `${CONSTANTS.MODULE_NAME} | ${warning}`;
	if (notify) ui.notifications?.warn(warning);
	console.warn(warning.replace("<br>", "\n"));
	return warning;
}
export function error(error, notify = true) {
	error = `${CONSTANTS.MODULE_NAME} | ${error}`;
	if (notify) ui.notifications?.error(error);
	return new Error(error.replace("<br>", "\n"));
}
export function timelog(message) {
	warn(Date.now(), message);
}
export const i18n = (key) => {
	return game.i18n.localize(key)?.trim();
};
export const i18nFormat = (key, data = {}) => {
	return game.i18n.format(key, data)?.trim();
};
// export const setDebugLevel = (debugText: string): void => {
//   debugEnabled = { none: 0, warn: 1, debug: 2, all: 3 }[debugText] || 0;
//   // 0 = none, warnings = 1, debug = 2, all = 3
//   if (debugEnabled >= 3) CONFIG.debug.hooks = true;
// };
export function dialogWarning(message, icon = "fas fa-exclamation-triangle") {
	return `<p class="${CONSTANTS.MODULE_NAME}-dialog">
        <i style="font-size:3rem;" class="${icon}"></i><br><br>
        <strong style="font-size:1.2rem;">${CONSTANTS.MODULE_NAME}</strong>
        <br><br>${message}
    </p>`;
}
// =========================================================================================

export function getTemplateContext(args = null, remoteContext = null) {
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
}
