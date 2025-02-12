# Titanic Survival Prediction API with Model Consensus

This API provides survival predictions for Titanic passengers using multiple machine learning models and a weighted consensus system.

## Installation and Setup

### Prerequisites
- Python 3.x
- pip (Python package installer)

### Installation Steps
1. Clone the repository:
```bash
git clone <repository_url>
cd workshop-3/part-A
```

2. Install required packages:
```bash
pip install -r requirements.txt
```

### Running the Application
1. Start the Flask server:
```bash
python app.py
```
2. Access the web interface at: `http://localhost:5000`


## Features

### 1. Multiple Models
- Logistic Regression
- Decision Tree
- Random Forest
- Support Vector Machine (SVM)

### 2. Two Prediction Endpoints
- `/predict`: Individual model prediction
- `/predict_consensus`: Weighted consensus from all active models

### 3. Staking System
- Each model starts with 1000 tokens
- Models are slashed (lose 100 tokens) if:
  - They have made at least 5 predictions
  - Their error rate exceeds 30%
- Models need at least 200 tokens to participate in consensus
- Models with insufficient stakes are excluded from consensus

### 4. Consensus Mechanism
- Models contribute to consensus based on their performance weights
- Weights are calculated from model accuracy on the Titanic dataset
- Only models with sufficient stakes participate
- Final prediction is a weighted average of probabilities

## API Endpoints

### GET /predict
Individual model prediction
```
/predict?model=logistic&pclass=3&sex=0&age=25&fare=7.25
```
Response:
```json
{
    "model": "logistic",
    "prediction": "Did not survive",
    "probability": 0.234
}
```

### GET /predict_consensus
Weighted consensus prediction
```
/predict_consensus?pclass=3&sex=0&age=25&fare=7.25
```
Response:
```json
{
    "model": "Weighted Consensus Model",
    "prediction": "Survived",
    "avg_probability": 0.75,
    "probabilities": {
        "decision": 0.82,
        "logistic": 0.71,
        "random": 0.68,
        "svm": 0.79
    },
    "details": {
        "decision": {
            "weight": 0.26,
            "balance": 1000,
            "error_rate": 0.0,
            "total_predictions": 1,
            "incorrect_predictions": 0,
            "is_active": true
        }
        // ... other models
    }
}
```

### GET /stakes
View current stakes and system parameters
```
/stakes
```

## Input Parameters
- `pclass`: Passenger class (1, 2, or 3)
- `sex`: Gender (0 for male, 1 for female)
- `age`: Age in years
- `fare`: Ticket fare
- `model`: Model name for individual prediction (logistic, decision, random, svm)

## System Initialization
- System resets on server startup
- Models start with equal weights
- Initial stakes are set to 1000 for each model
- Weights are recalculated based on model accuracy