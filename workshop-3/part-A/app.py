from flask import Flask, request, jsonify, render_template
import pickle
import os
from sklearn.metrics import accuracy_score
import pandas as pd
import numpy as np
import json
from datetime import datetime
from collections import OrderedDict

app = Flask(__name__)

# Dictionary to store loaded models and their performance (accuracy)
models = {}
model_performance = {}

# Load saved models
model_files = ["logistic_regression_model.pkl", "decision_tree_model.pkl", "random_forest_model.pkl", "svm_model.pkl"]
model_path = "models"

# Mapping for model names
MODEL_NAME_MAPPING = {
    "logistic_regression": "logistic",
    "decision_tree": "decision",
    "random_forest": "random",
    "svm_model": "svm"
}

if os.path.exists(model_path):
    for model_file in model_files:
        # Extract base name before '_model.pkl'
        base_name = model_file.split('_model.pkl')[0]
        model_name = MODEL_NAME_MAPPING.get(base_name, base_name)
        
        try:
            with open(f"{model_path}/{model_file}", 'rb') as file:
                models[model_name] = pickle.load(file)
            model_performance[model_name] = 0.25  # Initialize with equal weight
            print(f"{model_name} model loaded successfully!")
        except Exception as e:
            print(f"Failed to load {model_name}: {e}")
else:
    print("The 'models' directory does not exist.")

@app.route('/')
def home():
    return render_template('index.html')





## Single Models

# Evaluate models and update their performance
def evaluate_models():
    # Load Titanic dataset for evaluation
    url = 'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv'
    df = pd.read_csv(url)
    df = df[['Pclass', 'Sex', 'Age', 'Fare', 'Survived']].dropna()
    df['Sex'] = df['Sex'].map({'male': 0, 'female': 1})  # Convert 'Sex' to numerical values

    X = df[['Pclass', 'Sex', 'Age', 'Fare']]
    y = df['Survived']

    # Evaluate models and store their accuracies
    total_accuracy = 0
    print("\nInitial weights and performance:")
    for model_name, model in models.items():
        y_pred = model.predict(X)
        accuracy = accuracy_score(y, y_pred)
        model_performance[model_name] = accuracy  # Update model performance
        total_accuracy += accuracy
        print(f"{model_name} accuracy: {accuracy:.2f} | Initial weight: {0.25:.2f}")  # Print initial weights

    # Normalize the model performance (weights)
    print("\nNormalizing weights...")
    for model_name in model_performance:
        model_performance[model_name] /= total_accuracy  # Normalize to ensure weights sum to 1

    print("\nUpdated weights after normalization:")
    for model_name, weight in model_performance.items():
        print(f"{model_name}: {weight:.2f}")

# Run evaluation when starting the app
evaluate_models()



@app.route('/predict', methods=['GET'])
def predict():
    model_name = request.args.get('model', default='logistic', type=str)

    if model_name not in models:
        return jsonify({'error': f"Invalid model. Choose from {list(models.keys())}."})

    try:
        pclass = int(request.args.get('pclass'))
        sex = int(request.args.get('sex'))
        age = float(request.args.get('age'))
        fare = float(request.args.get('fare'))
    except (ValueError, TypeError) as e:
        return jsonify({'error': 'Invalid input parameters.'})

    input_data = [[pclass, sex, age, fare]]
    model = models[model_name]
    
    try:
        if model_name == 'svm':
            # For SVM, use decision_function to get probability
            decision = model.decision_function(input_data)[0]
            # Convert decision to probability using sigmoid function
            probability = 1 / (1 + np.exp(-decision))
        elif hasattr(model, 'predict_proba'):
            probability = float(model.predict_proba(input_data)[0, 1])
        else:
            prediction = model.predict(input_data)[0]
            probability = 1.0 if prediction == 1 else 0.0
        
        prediction = 'Survived' if probability >= 0.5 else 'Did not survive'
        return jsonify({
            'model': model_name,
            'probability': float(probability),
            'prediction': prediction
        })
    except Exception as e:
        print(f"Error predicting with {model_name}: {str(e)}")
        return jsonify({'error': f'Prediction error with {model_name}'})
    



## Concensus 

# Constants for stake system
INITIAL_STAKE = 1000
SLASH_THRESHOLD = 0.3  # 30% error rate threshold
SLASH_AMOUNT = 100
MINIMUM_STAKE = 200

@app.route('/predict_consensus', methods=['GET'])
def predict_consensus():
    try:
        pclass = int(request.args.get('pclass'))
        sex = int(request.args.get('sex'))
        age = float(request.args.get('age'))
        fare = float(request.args.get('fare'))
    except (ValueError, TypeError) as e:
        return jsonify({'error': 'Invalid input parameters.'})

    input_data = [[pclass, sex, age, fare]]

    predictions = []
    model_predictions = {}
    active_weights = []
    active_models = []
    model_details = {}
    
    print("\nProcessing predictions for input:", input_data)
    
    # First, get all predictions
    for model_name, model in models.items():
        try:
            if hasattr(model, 'predict_proba'):
                prob = float(model.predict_proba(input_data)[0, 1])
            elif hasattr(model, 'decision_function'):
                decision = model.decision_function(input_data)[0]
                prob = 1 / (1 + np.exp(-decision))
            else:
                prediction = model.predict(input_data)[0]
                prob = float(prediction)
            
            model_predictions[model_name] = prob
            
            # Collect model details
            total_preds = max(1, stakes_db[model_name]["total_predictions"])
            error_rate = stakes_db[model_name]["incorrect_predictions"] / total_preds
            model_details[model_name] = {
                "weight": float(model_performance[model_name]),
                "balance": stakes_db[model_name]["balance"],
                "error_rate": float(error_rate),
                "is_active": stakes_db[model_name]["balance"] >= MINIMUM_STAKE
            }
            
            # Only add to active predictions if stake is sufficient
            if stakes_db[model_name]["balance"] >= MINIMUM_STAKE:
                predictions.append(prob)
                active_weights.append(model_performance[model_name])
                active_models.append(model_name)
            
            print(f"{model_name} prediction: {prob:.2f}")
        except Exception as e:
            print(f"Error with {model_name}: {str(e)}")
            continue

    if not predictions:
        return jsonify({'error': 'No models available for prediction'})

    # Normalize weights for active models
    total_weight = sum(active_weights)
    if total_weight > 0:
        active_weights = [w/total_weight for w in active_weights]

    # Calculate weighted average using only active models
    weighted_avg = sum(p * w for p, w in zip(predictions, active_weights))
    consensus_prediction = 'Survived' if weighted_avg >= 0.5 else 'Did not survive'

    # Update model performances based on consensus
    for model_name in active_models:
        pred_prob = model_predictions[model_name]
        model_prediction = pred_prob >= 0.5
        consensus_prediction_bool = weighted_avg >= 0.5
        update_model_performance(model_name, model_prediction == consensus_prediction_bool)

    # Create ordered response
    ordered_response = OrderedDict([
        ('model', 'Weighted Consensus Model'),
        ('prediction', consensus_prediction),
        ('avg_probability', float(weighted_avg)),
        ('probabilities', OrderedDict(sorted(
            {model: float(prob) for model, prob in model_predictions.items()}.items()
        ))),
        ('details', OrderedDict(sorted(
            {model: {
                'weight': float(model_performance[model]),
                'balance': stakes_db[model]['balance'],
                'error_rate': float(stakes_db[model]['incorrect_predictions'] / max(1, stakes_db[model]['total_predictions'])),
                'total_predictions': stakes_db[model]['total_predictions'],
                'incorrect_predictions': stakes_db[model]['incorrect_predictions'],
                'is_active': stakes_db[model]['balance'] >= MINIMUM_STAKE
            } for model in model_predictions.keys()}.items()
        )))
    ])

    return jsonify(ordered_response)


## Slashing

# Load or initialize stakes database
def load_stakes():
    try:
        with open('model_stakes.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        stakes = {
            model_name: {
                "balance": INITIAL_STAKE,
                "total_predictions": 0,
                "incorrect_predictions": 0
            }
            for model_name in ["logistic", "decision", "random", "svm"]
        }
        save_stakes(stakes)
        return stakes

def save_stakes(stakes):
    with open('model_stakes.json', 'w') as f:
        json.dump(stakes, f)

# Initialize stakes
stakes_db = load_stakes()

def update_model_performance(model_name, was_correct):
    stakes_db[model_name]["total_predictions"] += 1
    if not was_correct:
        stakes_db[model_name]["incorrect_predictions"] += 1
    
    # Check if slashing is needed
    total = stakes_db[model_name]["total_predictions"]
    incorrect = stakes_db[model_name]["incorrect_predictions"]
    
    # Only evaluate after 5 predictions
    if total >= 5: 
        error_rate = incorrect / total
        if error_rate > SLASH_THRESHOLD:
            slash_model(model_name)
    
    save_stakes(stakes_db)

def slash_model(model_name):
    stakes_db[model_name]["balance"] -= SLASH_AMOUNT
    if stakes_db[model_name]["balance"] < MINIMUM_STAKE:
        # Remove model from consensus if stake too low
        model_performance[model_name] = 0
    save_stakes(stakes_db)

@app.route('/stakes', methods=['GET'])
def get_stakes():
    return jsonify({
        'stakes': stakes_db,
        'minimum_stake_required': MINIMUM_STAKE,
        'slash_threshold': SLASH_THRESHOLD,
        'slash_amount': SLASH_AMOUNT
    })

def initialize_system():
    """Initialize or reset the entire system"""
    global stakes_db, model_performance
    
    # Reset model performances
    for model_name in models:
        model_performance[model_name] = 0.25  # Equal weights initially
    
    # Reset stakes
    stakes_db = {
        model_name: {
            "balance": INITIAL_STAKE,
            "total_predictions": 0,
            "incorrect_predictions": 0
        }
        for model_name in models.keys()
    }
    save_stakes(stakes_db)
    
    # Re-evaluate models to get initial weights
    evaluate_models()

@app.route('/reset', methods=['POST'])
def reset_system():
    """Route to reset the system to initial state"""
    initialize_system()
    return jsonify({
        'message': 'System reset successfully',
        'stakes': stakes_db,
        'model_weights': {name: float(weight) for name, weight in model_performance.items()}
    })

# Juste avant le if __name__ == '__main__':
initialize_system()  # Initialise le système au démarrage

if __name__ == '__main__':
    app.run(debug=True)

