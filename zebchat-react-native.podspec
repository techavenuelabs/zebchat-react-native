require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "zebchat-react-native"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.source       = { :git => "https://github.com/techavenuelabs/zebchat-react-native.git", :tag => "v#{s.version}" }

  s.platforms    = { :ios => (defined?(min_ios_version_supported) ? min_ios_version_supported : "14.0") }
  s.swift_version = "5.9"
  s.source_files = "ios/**/*.{h,m,mm,swift}"

  # The ZebChat iOS SDK (CocoaPods trunk). Examples use `pod 'ZebChat', :path => '../../../ios'`.
  s.dependency "ZebChat", "~> 1.0"

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
