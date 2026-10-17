Pod::Spec.new do |s|
  s.name           = 'TheraHomePose'
  s.version        = '1.0.0'
  s.summary        = 'Live body-pose keypoints from the camera.'
  s.description    = 'A camera preview that also reports body keypoints, for real-time exercise form feedback.'
  s.author         = 'TheraHOME'
  s.homepage       = 'https://therahomeai.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # AVFoundation for the camera, Vision for the pose request. Both are
  # system frameworks — this module adds NOTHING to the binary and pulls in
  # no pod. That is the whole reason iOS uses Apple's Vision rather than
  # MediaPipe here: `pod 'MediaPipeTasksVision'` wants `use_frameworks!`,
  # and this app's Podfile is already carrying LiveKit WebRTC, CallKeep and
  # VoIP PushKit.
  s.frameworks = 'AVFoundation', 'Vision'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
