# What R8 must not touch.
#
# Appended to the generated android/app/proguard-rules.pro by
# plugins/withAndroidR8.js, which also explains why this is a file of our
# own rather than a string in app.json.
#
# Every rule here is a class reached by NAME at runtime — from JNI, from a
# manifest, or from a reflective lookup — which is exactly the kind R8
# cannot see and therefore deletes or renames. A missing rule does not fail
# the build. It fails the feature, in the release build only, as a
# ClassNotFoundException or an UnsatisfiedLinkError from somewhere deep
# inside a library. Nothing here is speculative: each block names the thing
# that breaks without it.

# ---------------------------------------------------------------- WebRTC
# The whole call stack. libwebrtc is C++ calling back into Java by name,
# and LiveKit ships it repackaged under `livekit.org.` with NO consumer
# rules of its own — the .aar has an empty classes.jar and no proguard.txt,
# so if this app does not keep these, nothing will.
#
# `livekit.org.**` and not `livekit.org.webrtc.**`: the first build with
# R8 on crashed the app on launch with
#
#   java.lang.ClassNotFoundException: livekit.org.jni_zero.JniInit
#   Fatal signal 5 (SIGTRAP) ... pid (ai.therahome)
#
# jni_zero is the bootstrap that registers every native method, and it sits
# in a SIBLING package to webrtc. The jar has exactly four:
# livekit.org.jni_zero, .jni_zero.internal, .webrtc and .webrtc.audio — so
# the rule is drawn one level up, where it cannot be outflanked again.
-keep class livekit.org.** { *; }
-dontwarn livekit.org.**
-keep class io.livekit.** { *; }
-dontwarn io.livekit.**
-keep class com.oney.WebRTCModule.** { *; }

# ------------------------------------------------------------- MediaPipe
# Pose detection: "tập cùng chuyên viên". Same situation as WebRTC —
# tasks-vision and tasks-core ship no proguard.txt — and the same shape of
# failure: a native graph that looks up Java classes and protobuf message
# fields by name. GeneratedMessageLite reads its fields reflectively, so
# the field names have to survive even where the class is kept.
-keep class com.google.mediapipe.** { *; }
-dontwarn com.google.mediapipe.**
-keep class com.google.protobuf.** { *; }
-keepclassmembers class * extends com.google.protobuf.GeneratedMessageLite { <fields>; }
-dontwarn com.google.protobuf.**
-keep class com.google.flatbuffers.** { *; }
-keep class org.tensorflow.lite.** { *; }
-dontwarn org.tensorflow.**

# ----------------------------------------------------------- Nitro / IAP
# react-native-iap is a Nitro module (com.margelo.nitro.iap), which is C++
# holding Java objects across JNI. Purchases are the one path in this app
# where a failure costs the customer money, so it is kept whole rather than
# trusted to an annotation.
-keep class com.margelo.nitro.** { *; }
-dontwarn com.margelo.nitro.**
-keep class com.android.billingclient.** { *; }

# ------------------------------------------- JavaScript with no app open
# How a killed app runs JavaScript: expo-task-manager and
# expo-notifications ask AppLoaderProvider for a loader, and it finds the
# class by reading a STRING out of a manifest <meta-data android:value>
# and calling Class.forName on it. AGP auto-keeps classes named in
# android:name; it has no way to know a `value` is a class name, so R8
# deleted this one and the app logged, on every launch:
#
#   java.lang.ClassNotFoundException:
#     expo.modules.adapters.react.apploader.RNHeadlessAppLoader
#
# Not fatal, which is what makes it dangerous — it does not crash, it just
# means no background task ever starts again. On this app that is the push
# that rings an Android phone for a call while the app is killed. The
# no-argument constructor matters as much as the class: the loader is
# built with getDeclaredConstructor().newInstance().
-keep class expo.modules.adapters.react.apploader.** { *; }
-keep class * implements expo.modules.apploader.HeadlessAppLoader {
  <init>();
  *;
}

# -------------------------------------------------------------- Telecom
# CallKeep's ConnectionService is named as a string in the manifest, which
# AGP keeps on its own; its helpers are reached from the telecom stack the
# same way and are not covered by that.
-keep class io.wazo.callkeep.** { *; }

# ------------------------------------------------------- our own modules
# modules/therahome-pose, -proximity and -callwindow. The Expo rules keep
# anything extending `Module`, but CallWindow is a plain Kotlin object the
# GENERATED MainActivity calls into, and PoseCameraView is reached from
# native camera callbacks. Three modules is a small enough surface to keep
# outright and stop thinking about.
-keep class ai.therahome.** { *; }

# -------------------------------------------------------------- Kotlin
# Expo's module definitions read Kotlin types through kotlin.Metadata to
# convert arguments; stripping it turns every typed argument into an error
# nobody can read.
-keep class kotlin.Metadata { *; }
-dontwarn kotlinx.coroutines.**

# ------------------------------------------------- readable crash reports
# Obfuscation is the point of this file's existence, but a stack trace of
# a.b.c() is worth nothing. These keep the line numbers, and rename the
# source file to one token so the mapping stays small. Play de-obfuscates
# automatically from the mapping.txt inside the AAB — which means the AAB
# is the artifact to upload, never a bare APK.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
