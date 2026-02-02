; Helix Desktop Windows Installer
; NSIS Script for creating Windows installer
;
; Note: Tauri uses its own NSIS template by default.
; This custom script is provided for advanced customization.
; To use: set "nsis.template" in tauri.conf.json

!include "MUI2.nsh"
!include "FileFunc.nsh"

; --------------------------------
; General Configuration
; --------------------------------

!define PRODUCT_NAME "Helix"
!define PRODUCT_PUBLISHER "Project Helix"
!define PRODUCT_WEB_SITE "https://project-helix.org"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKCU"

; Version will be passed from build script
!ifndef VERSION
  !define VERSION "1.0.0"
!endif

Name "${PRODUCT_NAME}"
OutFile "Helix-${VERSION}-Setup.exe"
InstallDir "$LOCALAPPDATA\${PRODUCT_NAME}"
InstallDirRegKey HKCU "Software\${PRODUCT_NAME}" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
ShowUnInstDetails show

; --------------------------------
; Modern UI Configuration
; --------------------------------

!define MUI_ABORTWARNING
!define MUI_ICON "..\..\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\..\src-tauri\icons\icon.ico"

; Welcome page
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${PRODUCT_NAME}.$\r$\n$\r$\nHelix is an AI that grows with you, remembers you, and evolves through experience.$\r$\n$\r$\nClick Next to continue."

; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_NAME}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch ${PRODUCT_NAME}"
!define MUI_FINISHPAGE_LINK "Visit project-helix.org"
!define MUI_FINISHPAGE_LINK_LOCATION "${PRODUCT_WEB_SITE}"

; --------------------------------
; Pages
; --------------------------------

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; --------------------------------
; Languages
; --------------------------------

!insertmacro MUI_LANGUAGE "English"

; --------------------------------
; Installation Section
; --------------------------------

Section "Install"
    SetOutPath $INSTDIR

    ; Main application files
    File /r "..\..\src-tauri\target\release\${PRODUCT_NAME}.exe"

    ; Resources (Node.js runtime, helix-engine, etc.)
    SetOutPath $INSTDIR\resources
    File /r "..\..\src-tauri\resources\*.*"

    ; Create Start Menu shortcuts
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe"
    CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

    ; Create Desktop shortcut
    CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_NAME}.exe"

    ; Register uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    ; Add to registry for Add/Remove Programs
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_NAME}.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${VERSION}"

    ; Calculate and write install size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"

    ; Register URL protocol (helix://)
    WriteRegStr HKCU "Software\Classes\helix" "" "URL:Helix Protocol"
    WriteRegStr HKCU "Software\Classes\helix" "URL Protocol" ""
    WriteRegStr HKCU "Software\Classes\helix\DefaultIcon" "" "$INSTDIR\${PRODUCT_NAME}.exe,0"
    WriteRegStr HKCU "Software\Classes\helix\shell\open\command" "" '"$INSTDIR\${PRODUCT_NAME}.exe" "%1"'

    ; Store installation directory in registry
    WriteRegStr HKCU "Software\${PRODUCT_NAME}" "InstallDir" "$INSTDIR"

SectionEnd

; --------------------------------
; Uninstallation Section
; --------------------------------

Section "Uninstall"
    ; Remove application files
    RMDir /r "$INSTDIR"

    ; Remove Start Menu shortcuts
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk"
    RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Remove Desktop shortcut
    Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

    ; Remove registry entries
    DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKCU "Software\${PRODUCT_NAME}"
    DeleteRegKey HKCU "Software\Classes\helix"

    ; Remove user data (optional - ask user)
    MessageBox MB_YESNO "Do you want to remove your Helix data and settings?" IDNO SkipDataRemoval
        RMDir /r "$APPDATA\${PRODUCT_NAME}"
        RMDir /r "$LOCALAPPDATA\${PRODUCT_NAME}"
    SkipDataRemoval:

SectionEnd

; --------------------------------
; Functions
; --------------------------------

Function .onInit
    ; Check if already installed
    ReadRegStr $R0 HKCU "Software\${PRODUCT_NAME}" "InstallDir"
    StrCmp $R0 "" done

    MessageBox MB_YESNO "${PRODUCT_NAME} is already installed. Do you want to reinstall?" IDYES done
    Abort

    done:
FunctionEnd

Function un.onInit
    MessageBox MB_YESNO "Are you sure you want to uninstall ${PRODUCT_NAME}?" IDYES +2
    Abort
FunctionEnd
