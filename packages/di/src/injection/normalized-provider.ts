import { ClassProvider, ExistingProvider, FactoryProvider, ValueProvider } from "./provider";

export interface NormalizedProvider extends ValueProvider, 
    ClassProvider, ExistingProvider, FactoryProvider { }
