export SCRIPTS="$1"
export OS="$(sed -n 's/^NAME="\([^"]*\)"/\1/p' /etc/os-release)"
export AMZ_LNX="Amazon Linux"
export CENTOS="CentOS Linux"
export REDHAT="Red Hat Enterprise Linux"
export SUSE="SLES"

export AWS_AVAIL_ZONE=$(curl http://169.254.169.254/latest/meta-data/placement/availability-zone)
export AWS_INSTANCE_ID=$(curl http://169.254.169.254/latest/meta-data/instance-id)
export AWS_REGION="$(echo "$AWS_AVAIL_ZONE" | sed 's/[a-z]$//')"
aws configure set default.region $AWS_REGION

function pmngr(){
  if [ "$OS" == "$SUSE" ]
    then zypper -n "$@"
    else yum -y "$@"
  fi
}
export -f pmngr

# Secured project settings
export SECRETS_ARN="$(aws ssm get-parameter --name /config/secrets_arn | jq --raw-output .Parameter.Value)"
export PROJECT="$(aws ssm get-parameter --name /config/account_config_arn | jq --raw-output .Parameter.Value)"
export BUCKET="$(aws ssm get-parameter --name /config/software_bucket | jq --raw-output .Parameter.Value)"

# Only attempt to install the security agents if the above config parameters are set in the host account.
# If they are not set, then we assume this is not an env we shoud install BCH/HMS software into, so we skip agent installation.
if [[ ! -z "$SECRETS_ARN" ]] && [[ ! -z "$PROJECT" ]] && [[ ! -z "$BUCKET" ]]; then
  pmngr install jq

  # Install git, set up private key, set up github configs, and clone scripts repo
  echo "## Pulling scripts from private repo hms-dbmi/lz-cicd-ec2-scripts"
  pmngr install git
  echo "[ssh.github.com]:443 ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=" >> ~/.ssh/known_hosts
  aws s3 cp s3://$BUCKET/lz-cicd-ec2-scripts-github-key.txt ~/.ssh/lz-cicd-ec2-scripts --sse AES256
  echo -e "Host github.com-lz-cicd-ec2-scripts\n  Hostname github.com\n  IdentityFile /root/.ssh/lz-cicd-ec2-scripts" >> ~/.ssh/config
  chmod 600 ~/.ssh/lz-cicd-ec2-scripts
  eval "$(ssh-agent -s)"
  ssh-add ~/.ssh/lz-cicd-ec2-scripts
  git clone -b feature/windows-agents ssh://git@ssh.github.com:443/hms-dbmi/lz-cicd-ec2-scripts.git "$SCRIPTS"

  # pull in util scripts and override update_status method to just print to console
  source $SCRIPTS/util_methods.sh 
  function update_status() {
    echo "## $1"
  }
  export -f  update_status

  $SCRIPTS/security_agents.sh 2>&1 >> "/var/log/security_agent_install.log"

  # Remove key and scripts folder
  rm ~/.ssh/lz-cicd-ec2
  rm "$SCRIPTS/lz-cicd-ec2-scripts"
fi