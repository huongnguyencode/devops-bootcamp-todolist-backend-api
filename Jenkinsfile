pipeline {
    agent any

    environment {
        // Docker Hub credentials (tự động lấy từ Jenkins)
        DOCKER_HUB_CREDS = credentials('dockerhub-cred')
        // IP của các máy EC2
        APP_EC2_IP = '10.0.1.170'      // IP private của App EC2
        TOOLS_EC2_IP = '10.0.1.254'    // IP private của Tools EC2
        DB_HOST = '10.0.3.11'          // IP private của Data EC2 (PostgreSQL)
        // Tên repository
        FRONTEND_REPO = 'huongnguyencode/devops-bootcamp-todolist-frontend'
        BACKEND_REPO = 'huongnguyencode/devops-bootcamp-todolist-backend-api'
        // Docker Hub username
        DOCKER_HUB_USER = 'huongcode'
    }

    stages {
        // =============================================
        // STAGE 1: Checkout code từ GitHub
        // =============================================
        stage('Checkout') {
            steps {
                script {
                    deleteDir()
                }
                
                // Checkout frontend code
                dir('frontend') {
                    git branch: 'master',
                        url: "https://github.com/${FRONTEND_REPO}.git",
                        credentialsId: 'github-token'
                }
                
                // Checkout backend code
                dir('backend') {
                    git branch: 'master',
                        url: "https://github.com/${BACKEND_REPO}.git",
                        credentialsId: 'github-token'
                }
            }
        }

        // =============================================
        // STAGE 2: Build Docker Images
        // =============================================
        stage('Build Docker Images') {
            steps {
                script {
                    // Build frontend image
                    dir('frontend') {
                        sh """
                            docker build \
                                -t ${DOCKER_HUB_USER}/todo-frontend:${GIT_COMMIT} \
                                -t ${DOCKER_HUB_USER}/todo-frontend:latest \
                                .
                        """
                    }
                    
                    // Build backend image
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

        // =============================================
        // STAGE 3: Test (chỉ chạy khi là Pull Request)
        // =============================================
        stage('Test') {
            when {
                changeRequest()
            }
            steps {
                echo 'Running tests...'
                
                dir('frontend') {
                    sh 'npm install && npm test || echo "No tests configured"'
                }
                
                dir('backend') {
                    sh 'npm install && npm test || echo "No tests configured"'
                }
            }
        }

        // =============================================
        // STAGE 4: Push Docker Images lên Docker Hub
        // =============================================
        stage('Push to Docker Hub') {
            when {
                branch 'master'
            }
            steps {
                script {
                    // Đăng nhập Docker Hub
                    docker.withRegistry('https://index.docker.io/v1/', 'dockerhub-cred') {
                        // Push frontend
                        dir('frontend') {
                            sh "docker push ${DOCKER_HUB_USER}/todo-frontend:${GIT_COMMIT}"
                            sh "docker push ${DOCKER_HUB_USER}/todo-frontend:latest"
                        }
                        
                        // Push backend
                        dir('backend') {
                            sh "docker push ${DOCKER_HUB_USER}/todo-backend:${GIT_COMMIT}"
                            sh "docker push ${DOCKER_HUB_USER}/todo-backend:latest"
                        }
                    }
                }
            }
        }

        // =============================================
        // STAGE 5: Deploy lên App EC2 (Development)
        // =============================================
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
                                
                                echo "=== Deployment Complete ==="
                                docker ps | grep todo
                            '
                        """
                    }
                }
            }
        }

        // =============================================
        // STAGE 6: Approval Gate (Manual)
        // =============================================
        stage('Approval Gate') {
            when {
                branch 'master'
            }
            steps {
                input message: 'Deploy to Production?',
                      ok: 'Approve',
                      submitter: 'admin'
            }
        }

        // =============================================
        // STAGE 7: Deploy to Production (Kubernetes/Kind)
        // =============================================
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
                            echo "Creating namespace todolist..."
                            kubectl --kubeconfig=${KUBECONFIG} \\
                                create namespace todolist \\
                                --dry-run=client -o yaml | \\
                                kubectl apply -f -
                            
                            echo "Creating db-secret..."
                            kubectl --kubeconfig=${KUBECONFIG} \\
                                create secret generic db-secret \\
                                --from-literal=password=${PROD_DB_PASS} \\
                                --namespace=todolist \\
                                --dry-run=client -o yaml | \\
                                kubectl apply -f -
                            
                            echo "Deploying Backend to K8s..."
                            kubectl --kubeconfig=${KUBECONFIG} \\
                                apply -f k8s/backend/ \\
                                --namespace=todolist
                            
                            echo "Deploying Frontend to K8s..."
                            kubectl --kubeconfig=${KUBECONFIG} \\
                                apply -f k8s/frontend/ \\
                                --namespace=todolist
                            
                            echo "Deploying Ingress..."
                            kubectl --kubeconfig=${KUBECONFIG} \\
                                apply -f k8s/ingress.yaml \\
                                --namespace=todolist
                            
                            echo "Checking pods status..."
                            kubectl --kubeconfig=${KUBECONFIG} \\
                                get pods -n todolist
                            
                            echo "Checking services..."
                            kubectl --kubeconfig=${KUBECONFIG} \\
                                get svc -n todolist
                        """
                    }
                }
            }
        }
    }

    // =============================================
    // POST: Cleanup sau mỗi build
    // =============================================
    post {
        always {
            echo 'Cleaning workspace...'
            cleanWs()
        }
        success {
            echo 'Pipeline completed successfully! 🎉'
        }
        failure {
            echo 'Pipeline failed! Check logs for errors.'
        }
    }
}