import "./api.js";
import CONSTANTS from "./constants.js";
import { renderDialogFinalBlow } from "./lib/lib.js";
export let aemlApi;
export const initHooks = () => {
    // warn("Init Hooks processing");
    // setup all the hooks
};
export const setupHooks = () => {
    // warn("Setup Hooks processing");
    //@ts-ignore
    aemlApi = game.modules.get("active-effect-manager-lib").api;
    aemlApi.effectInterface.initialize(CONSTANTS.MODULE_NAME);
};
export const readyHooks = async () => {
    // warn("Ready Hooks processing");
    //@ts-ignore
    // libWrapper.register(CONSTANTS.MODULE_NAME, "CONFIG.Actor.documentClass.prototype._preUpdate", _preUpdateActor, "WRAPPER");
    Hooks.on("preUpdateActor", async (actor, update, options, user) => {
        const hpUpdate = getProperty(update, "system.attributes.hp.value");
        if (hpUpdate === undefined) {
            return;
        }
        if (hpUpdate > 0) {
            return;
        }
        if (hpUpdate <= 0) {
            // await checkAndApply(this, update, options, user);
            // await zeroHPExpiry(actor, hpUpdate, user);
            await renderDialogFinalBlow(actor, hpUpdate, user);
        }
        return;
    });
    // Hooks.on('renderChatMessage', chatMessageEvent);
};
// ==========================================
// async function _preUpdateActor(wrapped, update, options, user) {
//   try {
//     const hpUpdate = <number>getProperty(update, "system.attributes.hp.value");
//     // await checkAndApply(this, update, options, user);
//     await zeroHPExpiry(this,  hpUpdate, user);
//   } catch (err) {
//     warn("preUpdateActor failed ", err)
//   }
//   finally {
//     return wrapped(update, options, user);
//   }
// }
