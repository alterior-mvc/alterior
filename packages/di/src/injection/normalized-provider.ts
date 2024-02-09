import { ClassProvider, ExistingProvider, FactoryProvider, TypeProvider, ValueProvider } from "./provider";

export interface NormalizedProvider extends TypeProvider, ValueProvider, 
    ClassProvider, ExistingProvider, FactoryProvider { }
