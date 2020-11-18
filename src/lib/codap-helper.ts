import codapInterface from "./CodapInterface";

export function initializePlugin(pluginName: string, version: string, dimensions: {width: number, height: number},
                                 iRestoreStateHandler:(arg0: any) => void) {
  const interfaceConfig = {
    customInteractiveStateHandler: true,
    name: pluginName,
    version: version,
    dimensions: dimensions,
    subscribeToDocuments: true
  };
  return codapInterface.init(interfaceConfig, iRestoreStateHandler);
}

