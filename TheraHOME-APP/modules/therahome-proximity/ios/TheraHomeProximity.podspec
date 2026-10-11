Pod::Spec.new do |s|
  s.name           = 'TheraHomeProximity'
  s.version        = '1.0.0'
  s.summary        = 'Screen blanking while the phone is at the ear.'
  s.description    = 'Wraps UIDevice proximity monitoring for TheraHOME calls.'
  s.author         = 'TheraHOME'
  s.homepage       = 'https://therahomeai.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
