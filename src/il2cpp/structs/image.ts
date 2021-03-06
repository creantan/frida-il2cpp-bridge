import { cache } from "decorator-cache-getter";
import { Api } from "../api";
import { Il2CppClass } from "./class";
import { getOrNull } from "../utils";
import { Accessor } from "../../utils/accessor";
import { Il2CppType } from "./type";
import { unityVersion } from "../variables";
import { NativeStruct } from "../native-struct";
import { nonNullHandle } from "../decorators";

/**
 * Represents a `Il2CppImage`.
 * ```typescript
 * let count = 0;
 * let prev: Il2Cpp.Image | undefined = undefined;
 * for (const assembly of Il2Cpp.domain.assemblies) {
 *     const current = assembly.image;
 *     if (prev != undefined && prev.classStart != -1) {
 *         assert(current.classStart == count);
 *     }
 *     count += current.classCount;
 *     prev = assembly.image;
 * }
 * //
 * const mscorlib = Il2Cpp.domain.assemblies.mscorlib.image;
 * assert(mscorlib.name == "mscorlib.dll");
 * ```
 */
@nonNullHandle
export class Il2CppImage extends NativeStruct {
    /**
     * @return The count of its classes.
     */
    @cache get classCount() {
        return Api._imageGetClassCount(this.handle);
    }

    /**
     * Non-generic types are stored in sequence.
     * @return The start index of its classes, `0` if this information
     * is not available (since Unity version `2020.2.0`).
     */
    @cache get classStart() {
        return Api._imageGetClassStart(this.handle);
    }

    /**
     * We can iterate over its classes using a `for..of` loop,
     * or access a specific assembly using its full type name.
     * ```typescript
     * const mscorlib = assemblies.mscorlib.image;
     * for (const klass of mscorlib.classes) {
     * }
     * const BooleanClass = mscorlib.classes["System.Boolean"];
     * ```
     * @return Its classes.
     */
    @cache get classes() {
        const accessor = new Accessor<Il2CppClass>();
        if (unityVersion.isLegacy) {
            const start = this.classStart;
            const end = start + this.classCount;
            const globalIndex = Memory.alloc(Process.pointerSize);
            globalIndex.add(Il2CppType.offsetOfTypeEnum).writeInt(0x20);
            for (let i = start; i < end; i++) {
                const klass = new Il2CppClass(Api._typeGetClassOrElementClass(globalIndex.writeInt(i)));
                accessor[klass.type!.name!] = klass;
            }
        } else {
            const end = this.classCount;
            for (let i = 0; i < end; i++) {
                const klass = new Il2CppClass(Api._imageGetClass(this.handle, i));
                accessor[klass.type.name] = klass;
            }
        }
        return accessor;
    }

    /**
     * @return Its name, equals to the name of its assembly plus its
     * extension.
     */
    @cache get name() {
        return Api._imageGetName(this.handle)!;
    }

    /**
     * @param namespace The class namespace.
     * @param name The class name.
     * @return The class for the given namespace and name or `null` if
     * not found.
     */
    getClassFromName(namespace: string, name: string) {
        return getOrNull(Api._classFromName(this.handle, namespace, name), Il2CppClass);
    }
}
