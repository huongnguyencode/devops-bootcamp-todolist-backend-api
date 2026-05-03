pipeline {
    agent any

    environment {
        DOCKER_HUB_CREDS = credentials('dockerhub-cred')
        APP_EC2_IP = '10.0.1.170'
        TOOLS_EC2_IP = '10.0.1.254'
        DB_HOST = '10.0.3.11'
        FRONTEND_REPO = 'huongnguyencode/devops-bootcamp-todolist-frontend'
        BACKEND_REPO = 'huongnguyencode/devops-bootcamp-todolist-backend-api'
        DOCKER_HUB_USER = 'huongcode'
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    deleteDir()
                }
                
                dir('frontend') {
                    git branch: 'master',
                        url: "https://github.com/${FRONTEND_REPO}.git",
                        credentialsId: 'github-token'
                }
                
                dir('backend') {
                    git branch: 'master',
                        url: "https://github.com/${BACKEND_REPO}.git",
                        credentialsId: 'github-token'
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                script {
                    dir('frontend') {
                        sh """
                            docker build \
                                -t ${DOCKER_HUB_USER}/todo-frontend:${GIT_COMMIT} \
                                -t ${DOCKER_HUB_USER}/todo-frontend:latest \
                                .
                        """
                    }
                    
                    dir('backend') {
                        sh """
                            docker build \
                                -t ${DOCKER_HUB_USER}/todo-backend:${GIT_COMMIT} \
                                -t ${DOCKER_HUB_USER}/todo-backend:latest \
                                .
                        """
                    }
                }
            }
        }

        stage('Push to Docker Hub') {
            when {
                branch 'master'
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-cred', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    script {
                        sh """
                            echo "${DOCKER_PASS}" | docker login -u "${DOCKER_USER}" --password-stdin
                            
                            cd frontend
                            docker push ${DOCKER_HUB_USER}/todo-frontend:${GIT_COMMIT}
                            docker push ${DOCKER_HUB_USER}/todo-frontend:latest
                            
                            cd ../backend
                            docker push ${DOCKER_HUB_USER}/todo-backend:${GIT_COMMIT}
                            docker push ${DOCKER_HUB_USER}/todo-backend:latest
                        """
                    }
                }
            }
        }

        stage('Deploy to Dev') {
            when {
                branch 'master'
            }
            steps {
                withCredentials([
                    string(credentialsId: 'dev-db-user', variable: 'DB_USER'),
                    string(credentialsId: 'dev-db-pass', variable: 'DB_PASS'),
                    sshUserPrivateKey(credentialsId: 'app-ec2-ssh', keyFileVariable: 'SSH_KEY')
                ]) {
                    script {
                        sh """
                            ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ubuntu@${APP_EC2_IP} '
                                echo "=== Deploying Backend ==="
                                docker stop todo-backend || true
                                docker rm todo-backend || true
                                docker pull ${DOCKER_HUB_USER}/todo-backend:latest
                                docker run -d \\
                                    --name todo-backend \\
                                    --restart unless-stopped \\
                                    -p 5000:5000 \\
                                    -e DATABASE_HOST=${DB_HOST} \\
                                    -e DATABASE_PORT=5432 \\
                                    -e DATABASE_NAME=devdb \\
                                    -e DATABASE_USER=${DB_USER} \\
                                    -e DATABASE_PASSWORD=${DB_PASS} \\
                                    -e PORT=5000 \\
                                    -e NODE_ENV=development \\
                                    ${DOCKER_HUB_USER}/todo-backend:latest
                                
                                echo "=== Deploying Frontend ==="
                                docker stop todo-frontend || true
                                docker rm todo-frontend || true
                                docker pull ${DOCKER_HUB_USER}/todo-frontend:latest
                                docker run -d \\
                                    --name todo-frontend \\
                                    --restart unless-stopped \\
                                    -p 3000:3000 \\
                                    -e NEXT_PUBLIC_API_URL=http://${APP_EC2_IP}:5000/api \\
                                    ${DOCKER_HUB_USER}/todo-frontend:latest
                            '
                        """
                    }
                }
            }
        }

        stage('Approval Gate') {
            when {
                branch 'master'
            }
            steps {
                input message: 'Deploy to Production?', ok: 'Approve'
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'master'
            }
            steps {
                withCredentials([
                    file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG'),
                    string(credentialsId: 'prod-db-pass', variable: 'PROD_DB_PASS')
                ]) {
                    script {
                        sh """
                            kubectl --kubeconfig=${KUBECONFIG} create namespace todolist --dry-run=client -o yaml | kubectl apply -f -
                            kubectl --kubeconfig=${KUBECONFIG} create secret generic db-secret --from-literal=password=${PROD_DB_PASS} --namespace=todolist --dry-run=client -o yaml | kubectl apply -f -
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}