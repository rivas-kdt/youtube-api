// Browser/React Native compatible script execution
class NativeVM {
    constructor(code) {
        this.code = code;
        this.isDebug = false; // Disable debugging for production
    }
    
    runInNewContext(context) {
        if (this.isDebug) {
            console.log('Executing code with context:', Object.keys(context));
            console.log('Code to execute:', this.code.substring(0, 300) + '...');
        }
        
        try {
            // Create execution environment and execute the YouTube code
            const contextKeys = Object.keys(context);
            const contextValues = contextKeys.map(key => context[key]);
            
            // The extracted code defines functions but doesn't call them
            // We need to execute the code and then call the appropriate function
            const wrappedCode = `
                // Set up context variables
                ${contextKeys.map((key, index) => `var ${key} = arguments[${index}];`).join('\n')}
                
                // Execute the extracted YouTube code (defines functions and variables)
                ${this.code}
                
                // Now call the appropriate function based on context
                ${contextKeys.includes('sig') ? `
                    if (typeof DisTubeDecipherFunc === 'function') {
                        return DisTubeDecipherFunc(sig);
                    }
                ` : ''}
                ${contextKeys.includes('ncode') ? `
                    if (typeof DisTubeNTransformFunc === 'function') {
                        return DisTubeNTransformFunc(ncode);
                    }
                ` : ''}
                
                // Fallback: return null if no appropriate function found
                return null;
            `;
            
            const execFunction = new Function(wrappedCode);
            const result = execFunction.apply(null, contextValues);
            
            if (this.isDebug) {
                console.log('Execution result:', result);
                console.log('Result type:', typeof result);
            }
            
            return result;
            
        } catch (error) {
            console.error('NativeVM execution failed:', error);
            console.error('Context:', context);
            
            // Enhanced fallback with non-strict mode
            try {
                const contextKeys = Object.keys(context);
                const contextValues = contextKeys.map(key => context[key]);
                
                const fallbackCode = `
                    ${contextKeys.map((key, index) => `var ${key} = arguments[${index}];`).join('\n')}
                    
                    (function() {
                        ${this.code}
                        
                        if (typeof DisTubeDecipherFunc === 'function' && typeof sig !== 'undefined') {
                            return DisTubeDecipherFunc(sig);
                        }
                        if (typeof DisTubeNTransformFunc === 'function' && typeof ncode !== 'undefined') {
                            return DisTubeNTransformFunc(ncode);
                        }
                        return null;
                    })()
                `;
                
                const fallbackFunction = new Function(fallbackCode);
                const fallbackResult = fallbackFunction.apply(null, contextValues);
                
                if (this.isDebug) console.log('Fallback result:', fallbackResult);
                return fallbackResult;
                
            } catch (fallbackError) {
                console.error('Fallback execution also failed:', fallbackError);
                return null;
            }
        }
    }
}


export const vm = {
    Script: NativeVM
}

export default NativeVM;