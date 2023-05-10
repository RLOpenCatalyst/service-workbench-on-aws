[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Install Git from github
$git_installer = "https://github.com/git-for-windows/git/releases/download/v2.40.0.windows.1/Git-2.40.0-64-bit.exe"
Invoke-WebRequest "$git_installer" -OutFile .\install_git.exe
$git_config = @"
[Setup]
Lang=default
Dir=C:\Program Files\Git
Group=Git
NoIcons=0
SetupType=default
Components=ext,ext\shellhere,ext\guihere,gitlfs,assoc,assoc_sh,scalar
Tasks=
EditorOption=VIM
CustomEditorPath=
DefaultBranchOption= 
PathOption=Cmd
SSHOption=OpenSSH
TortoiseOption=false
CURLOption=OpenSSL
CRLFOption=CRLFAlways
BashTerminalOption=MinTTY
GitPullBehaviorOption=Merge
UseCredentialManager=Enabled
PerformanceTweaksFSCache=Enabled
EnableSymlinks=Disabled
EnablePseudoConsoleSupport=Disabled
EnableFSMonitor=Disabled
"@ | Out-File -FilePath .\git_config.txt
.\install_git.exe /LOADINF="git_config.txt" /VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS="icons,ext\reg\shellhere,assoc,assoc_sh"
$Env:Path += [IO.Path]::PathSeparator + "$env:ProgramFiles\Git\bin"
Remove-Item -Path git_config.txt
Remove-Item -Path install_git.exe

# NOTES: Out-File adds BOM characters which mess up bash, and we have 
# to use bash's OpenSSH because Windows 2016 server doesn't have
# access to install it. So we're using .NET file writing and 
# git-bash commands below.

# Set up github configs and keys
New-Item "$env:UserProfile\.ssh" -ItemType Directory
[System.IO.File]::WriteAllLines("$env:UserProfile\.ssh\known_hosts", "[ssh.github.com]:443 ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=")
$bucket="$(Get-SSMParameter -Name "/config/software_bucket" -Select "Parameter.Value")"
Read-S3Object -BucketName $bucket -Key 'lz-cicd-ec2-scripts-github-key.txt' -File "$env:UserProfile\.ssh\lz-cicd-ec2-scripts"
[System.IO.File]::WriteAllLines("$env:UserProfile\.ssh\config", @"
Host github.com-lz-cicd-ec2-scripts
  Hostname github.com
  IdentityFile /root/.ssh/lz-cicd-ec2-scripts
"@)

# Change file permissions, start ssh agent, and clone git repo using newly installed bash cli because powershell is way more complicated
bash -c @'
chmod 600 ~/.ssh/lz-cicd-ec2-scripts
eval `ssh-agent -s`
ssh-add ~/.ssh/lz-cicd-ec2-scripts
git clone ssh://git@ssh.github.com:443/hms-dbmi/lz-cicd-ec2-scripts.git ./lz-cicd-ec2-scripts
'@

Remove-Item -Path "$env:UserProfile\.ssh\lz-cicd-ec2-scripts"

# Run security script
.\lz-cicd-ec2-scripts\windows\security_agents.ps1

Remove-Item -Recurse -Force .\lz-cicd-ec2-scripts\