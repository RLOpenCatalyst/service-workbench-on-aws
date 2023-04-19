export OS="$(sed -n 's/^NAME="\([^"]*\)"/\1/p' /etc/os-release)"
export AMZ_LNX="Amazon Linux"
export CENTOS="CentOS Linux"
export REDHAT="Red Hat Enterprise Linux"
export SUSE="SLES"

export AWS_AVAIL_ZONE=$(curl http://169.254.169.254/latest/meta-data/placement/availability-zone)
export AWS_INSTANCE_ID=$(curl http://169.254.169.254/latest/meta-data/instance-id)
export AWS_REGION="$(echo "$AWS_AVAIL_ZONE" | sed 's/[a-z]$//')"

function pmngr() {
  if [ "$OS" == "$SUSE" ]
    then zypper -n "$@"
    else yum -y "$@"
  fi
}
function get_secret() {
  aws secretsmanager get-secret-value --secret-id "$1" --output text --query SecretString --region $AWS_REGION | jq --raw-output ".$2"
}
function update_status() {
  echo "## $1"
}
export -f pmngr get_secret update_status

pmngr install jq

export SECRETS_ARN="$(aws ssm get-parameter --name /config/secrets_arn --region $AWS_REGION | jq --raw-output .Parameter.Value)"
export PROJECT="$(aws ssm get-parameter --name /config/account_config_arn --region $AWS_REGION | jq --raw-output .Parameter.Value)"
export BUCKET="$(aws ssm get-parameter --name /config/software_bucket --region $AWS_REGION | jq --raw-output .Parameter.Value)"

if [[ ! -z "$SECRETS_ARN" ]] && [[ ! -z "$PROJECT" ]] && [[ ! -z "$BUCKET" ]]; then
  # Install git, set up private key, set up github configs, and clone scripts repo
  echo "## Pulling scripts from private repo hms-dbmi/lz-cicd-ec2-scripts"
  pmngr install git
  echo "[ssh.github.com]:443 ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=" >> ~/.ssh/known_hosts
  aws secretsmanager get-secret-value --secret-id lz-cicd-ec2-scripts --output text --query SecretString > ~/.ssh/lz-cicd-ec2-scripts
  echo -e "Host github.com-lz-cicd-ec2-scripts\n  Hostname github.com\n  IdentityFile /root/.ssh/lz-cicd-ec2-scripts" >> ~/.ssh/config
  chmod 600 ~/.ssh/lz-cicd-ec2-scripts
  eval "$(ssh-agent -s)"
  ssh-add ~/.ssh/lz-cicd-ec2-scripts
  git clone ssh://git@ssh.github.com:443/hms-dbmi/lz-cicd-ec2-scripts.git "$SCRIPTS"

  $SCRIPTS/security_agents.sh
fi