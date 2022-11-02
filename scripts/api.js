const API = {
    executeMacroArr(...inAttributes) {
        if (inAttributes && !Array.isArray(inAttributes)) {
          throw error('executeMacroArr | inAttributes must be of type array');
        }
        this.executeMacro();
    },
    executeMacro() {
        
    },
};
export default API;
