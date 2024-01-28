
export function disallowNativeAsync(func: Function) {
    if (typeof func !== 'function')
        return;
   
    if (func.constructor.name === 'AsyncFunction') {
        console.error();
        console.error(`----------------------------------------------------------------------------------------------------`);
        console.error(`Detected usage of a native async function in a context where it is not allowed.`);
        console.error(`Unfortunately, native async/await is not supported by Alterior, as it breaks Zone tracking.`);
        console.error(`Please ensure compilerOptions.target is set to ES2016 or lower, and keep in mind that `);
        console.error(`dependencies compiled with native async/await support may cause problems for some Alterior features.`);
        console.error(`For more information, please see https://github.com/angular/angular/issues/31730`);
        console.error(` - Function name: ${func.name}`);
        console.error(` - Function implementation:`);
        console.error(`   ${String(func).replace(/\n/g, "\n   ")}`);
        console.error(`----------------------------------------------------------------------------------------------------`);
        console.error();
        throw new Error(`Native async/await is not supported [${func.name}()].`);
    }
}