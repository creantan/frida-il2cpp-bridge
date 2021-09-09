import { inform, ok } from "../utils/console";
import { formatNativePointer, getUntilFound } from "../utils/utils";

/** Dumping utilities. */
class Il2CppDumper {
    /** */
    static get defaultDirectoryPath(): string {
        const UnityEngine = getUntilFound(Il2Cpp.Domain.assemblies, "UnityEngine.CoreModule", "UnityEngine")!.image;
        const Application = UnityEngine.classes["UnityEngine.Application"];
        return Application.methods.get_persistentDataPath.invoke<Il2Cpp.String>().content!;
    }

    /** */
    static get defaultFileName(): string {
        const UnityEngine = getUntilFound(Il2Cpp.Domain.assemblies, "UnityEngine.CoreModule", "UnityEngine")!.image;
        const Application = UnityEngine.classes["UnityEngine.Application"];

        try {
            const identifier = getUntilFound(Application.methods, "get_identifier", "get_bundleIdentifier")!.invoke<Il2Cpp.String>();
            const version = Application.methods.get_version.invoke<Il2Cpp.String>();
            return `${identifier.content}_${version.content}`;
        } catch (e) {
            return `${new Date().getTime()}`;
        }
    }

    /** @internal */
    #directoryPath?: string;

    /** @internal */
    #fileName?: string;

    /** @internal */
    #extension?: string;

    /** @internal */
    #generator?: () => Generator<string>;

    directoryPath(directoryPath: string): Pick<Il2Cpp.Dumper, "fileName" | "classes" | "methods"> {
        this.#directoryPath = directoryPath;
        return this;
    }

    fileName(fileName: string): Pick<Il2Cpp.Dumper, "classes" | "methods"> {
        this.#fileName = fileName;
        return this;
    }

    classes(): Pick<Il2Cpp.Dumper, "build"> {
        this.#generator = function* (): Generator<string> {
            for (const assembly of Il2Cpp.Domain.assemblies) {
                inform(`Dumping \x1b[1m${assembly.name}\x1b[0m...`);
                
                for (const klass of assembly.image.classes) {
                    yield klass.toString();
                }
            }
        }

        this.#extension = "cs";
        return this;
    }

    methods(): Pick<Il2Cpp.Dumper, "build"> {
        const SystemType = Il2Cpp.Image.corlib.classes["System.Type"];
        const SystemObject = Il2Cpp.Image.corlib.classes["System.Object"].type.object;

        const getTypeArray = (genericParameterCount: number): Il2Cpp.Array<Il2Cpp.Object> =>
            Il2Cpp.Array.from(SystemType, Array(genericParameterCount).fill(SystemObject));

        this.#generator = function* (): Generator<string> {
            for (const assembly of Il2Cpp.Domain.assemblies) {
                inform(`Dumping methods from \x1b[1m${assembly.name}\x1b[0m...`);

                for (let klass of assembly.image.classes) {
                    if (klass.isGeneric) {
                        klass = klass.inflateRaw(getTypeArray(klass.genericParameterCount));
                    }
                    
                    for (let method of klass.methods) {
                        if (method.isGeneric && !klass.isGeneric) {
                            method = method.inflateRaw(getTypeArray(method.genericParameterCount));
                        }

                        if (!method.virtualAddress.isNull()) {
                            yield `${formatNativePointer(method.relativeVirtualAddress)} ${klass.type.name}.${method.name}\n`;
                        }
                    }
                }
            }
        }

        this.#extension = "ms";
        return this;
    }

    build(): void {
        const directoryPath = (this.#directoryPath) ?? Il2Cpp.Dumper.defaultDirectoryPath;
        const fileName = (this.#fileName) ?? Il2Cpp.Dumper.defaultFileName;

        const destinationPath = `${directoryPath}/${fileName}.${this.#extension ?? "dump"}`;
        const file = new File(destinationPath, "w");

        for (const chunk of this.#generator!()) {
            file.write(chunk);
        }

        file.flush();
        file.close();
        ok(`Dump saved to ${destinationPath}.`);
    }
}

Il2Cpp.Dumper = Il2CppDumper;

declare global {
    namespace Il2Cpp {
        class Dumper extends Il2CppDumper {}
    }
}
