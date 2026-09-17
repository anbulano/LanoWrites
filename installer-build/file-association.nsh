; Register LanoWrites projects (.lanowrites, plus older .scenecraft files) for the current Windows user.
!macro customInstall
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.lanowrites\UserChoice"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.scenecraft\UserChoice"
  WriteRegStr HKCU "Software\Classes\.lanowrites" "" "LanoWrites.Project"
  WriteRegStr HKCU "Software\Classes\.lanowrites" "Content Type" "application/x-lanowrites"
  WriteRegStr HKCU "Software\Classes\.lanowrites\OpenWithProgids" "LanoWrites.Project" ""
  WriteRegStr HKCU "Software\Classes\.scenecraft" "" "LanoWrites.Project"
  WriteRegStr HKCU "Software\Classes\.scenecraft\OpenWithProgids" "LanoWrites.Project" ""
  WriteRegStr HKCU "Software\Classes\LanoWrites.Project" "" "LanoWrites Project"
  WriteRegStr HKCU "Software\Classes\LanoWrites.Project" "FriendlyTypeName" "LanoWrites Project"
  WriteRegStr HKCU "Software\Classes\LanoWrites.Project\DefaultIcon" "" "$INSTDIR\resources\icon.ico,0"
  WriteRegStr HKCU "Software\Classes\LanoWrites.Project\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\LanoWrites.Project\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "LanoWrites"
  WriteRegStr HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".lanowrites" ""
  WriteRegStr HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" ".scenecraft" ""
  WriteRegStr HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr HKCU "Software\LanoWrites\Capabilities" "ApplicationName" "LanoWrites"
  WriteRegStr HKCU "Software\LanoWrites\Capabilities" "ApplicationDescription" "Screenplay writing and production planning"
  WriteRegStr HKCU "Software\LanoWrites\Capabilities\FileAssociations" ".lanowrites" "LanoWrites.Project"
  WriteRegStr HKCU "Software\LanoWrites\Capabilities\FileAssociations" ".scenecraft" "LanoWrites.Project"
  WriteRegStr HKCU "Software\RegisteredApplications" "LanoWrites" "Software\LanoWrites\Capabilities"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\LanoWrites.Project"
  DeleteRegKey HKCU "Software\Classes\.lanowrites"
  DeleteRegValue HKCU "Software\Classes\.scenecraft\OpenWithProgids" "LanoWrites.Project"
  DeleteRegKey HKCU "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
  DeleteRegKey HKCU "Software\LanoWrites\Capabilities"
  DeleteRegValue HKCU "Software\RegisteredApplications" "LanoWrites"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
