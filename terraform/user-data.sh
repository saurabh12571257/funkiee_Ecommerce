#!/bin/bash
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker

# Create environment file
cat > /home/ubuntu/.env << EOL
DB_USER=${db_username}
DB_PASS=${db_password}
DB_HOST=${db_endpoint}
DB_NAME=${db_name}
JWT_SECRET=${jwt_secret}
EOL

sudo docker pull ${docker_image}
sudo docker run -d \
  --name nodecontainer \
  -p 3000:3000 \
  --env-file /home/ubuntu/.env \
  ${docker_image} 