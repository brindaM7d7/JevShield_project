// Jenkinsfile - Declarative CI/CD Pipeline for JevShield
// Built for Jenkins on a Linux agent with Docker and Python 3.11+
// Enforces ML Accuracy Gates, Automated Testing, and Container Packaging

pipeline {
    agent any

    environment {
        // Build settings & paths
        DATA_FILE = 'data/sample_urls.csv'
        MIN_ACCURACY = '0.90'
        IMAGE_NAME = 'jevshield'
        CONTAINER_NAME = "jevshield-smoke-${BUILD_NUMBER}"
        PORT = '5000'

        // Optional credentials IDs configured in Jenkins Credentials Store
        ANTHROPIC_CREDENTIALS_ID = 'ANTHROPIC_API_KEY'
        DOCKER_CREDENTIALS_ID = 'DOCKER_HUB_CREDENTIALS'
    }

    stages {
        // ====================================================================
        // STAGE 1: Source Code Checkout
        // ====================================================================
        stage('Checkout') {
            steps {
                echo "--> Stage 1: Checking out source code from Git repository..."
                checkout scm
            }
        }

        // ====================================================================
        // STAGE 2: Dependency Installation
        // ====================================================================
        stage('Install Dependencies') {
            steps {
                echo "--> Stage 2: Creating Python virtual environment and installing dependencies..."
                sh '''
                    python3 -m venv venv
                    . venv/bin/activate
                    pip install --upgrade pip
                    pip install -r requirements.txt
                '''
            }
        }

        // ====================================================================
        // STAGE 3: Model Training & Accuracy Quality Gate
        // ====================================================================
        stage('Train & Accuracy Gate') {
            steps {
                echo "--> Stage 3: Training ML models and enforcing accuracy/recall gates..."
                sh '''
                    . venv/bin/activate
                    # train.py uses DATA_FILE=data/sample_urls.csv and checks MIN_ACCURACY >= 0.90
                    # If test accuracy or phishing recall is below 90%, it exits with code 1, FAILING the build
                    python train.py
                '''
            }
        }

        // ====================================================================
        // STAGE 4: Automated Pytest Suite
        // ====================================================================
        stage('Test Suite') {
            steps {
                echo "--> Stage 4: Running full pytest test suite (34 unit & integration tests)..."
                sh '''
                    . venv/bin/activate
                    pytest -v
                '''
            }
        }

        // ====================================================================
        // STAGE 5: Build Docker Container Image
        // ====================================================================
        stage('Build Docker Image') {
            steps {
                echo "--> Stage 5: Building Docker container image (tagged with build number and latest)..."
                sh '''
                    docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} -t ${IMAGE_NAME}:latest .
                '''
            }
        }

        // ====================================================================
        // STAGE 6: Container Run & Smoke Tests
        // ====================================================================
        stage('Run & Smoke Test') {
            steps {
                echo "--> Stage 6: Running containerized app and performing live HTTP health & predict probes..."
                sh '''
                    # Start container detached on port 5000
                    docker run -d --name ${CONTAINER_NAME} -p ${PORT}:5000 -e ANTHROPIC_API_KEY="" ${IMAGE_NAME}:${BUILD_NUMBER}

                    # Polling retry loop: wait up to 30 seconds for /health to return HTTP 200
                    echo "Waiting for container /health to become ready..."
                    READY=0
                    for i in $(seq 1 30); do
                        STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/health || true)
                        if [ "$STATUS" = "200" ]; then
                            echo "Container is ready on port ${PORT}! (Attempt $i)"
                            READY=1
                            break
                        fi
                        echo "Attempt $i: /health returned $STATUS, sleeping 1s..."
                        sleep 1
                    done

                    if [ "$READY" -ne 1 ]; then
                        echo "ERROR: Container health check timed out after 30 seconds!"
                        docker logs ${CONTAINER_NAME}
                        exit 1
                    fi

                    # Smoke test 1: Healthcheck endpoint probe
                    echo "--> Smoke test 1: GET /health"
                    curl -f -s http://localhost:${PORT}/health

                    # Smoke test 2: Phishing prediction endpoint probe
                    echo ""
                    echo "--> Smoke test 2: POST /predict"
                    curl -f -s -X POST http://localhost:${PORT}/predict \
                         -H "Content-Type: application/json" \
                         -d '{"url":"http://paypal-security-login.com/auth"}'
                    echo ""
                '''
            }
        }

        // ====================================================================
        // STAGE 7: Optional Docker Hub Registry Push
        // ====================================================================
        stage('Push to Registry (Optional)') {
            steps {
                script {
                    echo "--> Stage 7: Checking for configured Docker Hub credentials..."
                    // Check if credentials ID exists in Jenkins credentials store
                    def dockerCredsExist = false
                    try {
                        withCredentials([usernamePassword(credentialsId: DOCKER_CREDENTIALS_ID, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                            dockerCredsExist = true
                            sh '''
                                echo "Logging in to Docker Hub as ${DOCKER_USER}..."
                                echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                                docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${DOCKER_USER}/${IMAGE_NAME}:${BUILD_NUMBER}
                                docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${DOCKER_USER}/${IMAGE_NAME}:latest
                                docker push ${DOCKER_USER}/${IMAGE_NAME}:${BUILD_NUMBER}
                                docker push ${DOCKER_USER}/${IMAGE_NAME}:latest
                                echo "Successfully pushed images to Docker Hub registry!"
                            '''
                        }
                    } catch (Exception e) {
                        echo "Docker Hub credentials '${DOCKER_CREDENTIALS_ID}' not configured or login skipped: ${e.getMessage()}"
                        echo "Skipping Docker Hub push stage cleanly without failing the build."
                    }
                }
            }
        }
    }

    // ========================================================================
    // POST-EXECUTION CLEANUP & ARTIFACT ARCHIVING
    // ========================================================================
    post {
        always {
            echo "--> Post-Execution: Stopping and removing temporary test container..."
            sh '''
                docker stop ${CONTAINER_NAME} 2>/dev/null || true
                docker rm -f ${CONTAINER_NAME} 2>/dev/null || true
            '''
        }
        success {
            echo "--> CI/CD PIPELINE SUCCEEDED: Archiving machine learning evaluation artifacts..."
            archiveArtifacts artifacts: 'model/metrics.json, model/feature_importance.png, model/comparison.csv', fingerprint: true
        }
        failure {
            echo "--> CI/CD PIPELINE FAILED: Please check stage logs above for accuracy gate or test failures."
        }
    }
}
