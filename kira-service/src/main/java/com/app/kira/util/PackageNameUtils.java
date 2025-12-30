package com.app.kira.util;

import lombok.experimental.UtilityClass;

@UtilityClass
public class PackageNameUtils {

    /**
     * Returns the canonical method name for a given class and method name.
     *
     * @param clazz      the class to get the method name from
     * @param methodName the name of the method
     * @return the canonical method name in the format "ClassName.methodName"
     */
    public String getCanonicalMethodName(Class<?> clazz, String methodName) {
        return getPackageName(clazz) + "." + methodName;
    }

    /**
     * Returns the package name of the given class.
     *
     * @param clazz the class to get the package name from
     * @return the package name of the class
     */
    public String getPackageName(Class<?> clazz) {
        return clazz.getCanonicalName();
    }
}
