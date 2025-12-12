Dim WshShell, fso, scriptDir, cmd
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "cmd /c cd /d """ & scriptDir & """ && start_proper_sequence.bat"
WshShell.Run cmd, 0, False
Set WshShell = Nothing
Set fso = Nothing


