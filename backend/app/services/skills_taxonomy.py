"""A compact skills taxonomy used for deterministic resume parsing.

Canonical name -> (category, aliases). Matching is case-insensitive on word boundaries.
The LLM extractor finds things this list misses; this list guarantees a reliable
baseline (and works offline).
"""
from __future__ import annotations

TAXONOMY: dict[str, tuple[str, list[str]]] = {
    # Languages
    "Python": ("language", ["python", "python3"]),
    "R": ("language", [r"\bR\b(?= ?(?:programming|language|studio|,))", "rstudio"]),
    "SQL": ("language", ["sql", "mysql", "postgresql", "postgres", "sqlite", "t-sql", "pl/sql"]),
    "Java": ("language", ["java"]),
    "C++": ("language", ["c\\+\\+", "cpp"]),
    "JavaScript": ("language", ["javascript", "js", "node.js", "nodejs"]),
    "TypeScript": ("language", ["typescript"]),
    "Go": ("language", ["golang"]),
    "Scala": ("language", ["scala"]),
    "MATLAB": ("language", ["matlab"]),
    # ML frameworks / libraries
    "PyTorch": ("ml_framework", ["pytorch", "torch"]),
    "TensorFlow": ("ml_framework", ["tensorflow", "tf2", "tf 2"]),
    "Keras": ("ml_framework", ["keras"]),
    "scikit-learn": ("ml_framework", ["scikit-learn", "sklearn", "scikit learn"]),
    "XGBoost": ("ml_framework", ["xgboost"]),
    "LightGBM": ("ml_framework", ["lightgbm"]),
    "Hugging Face": ("ml_framework", ["hugging ?face", "transformers library"]),
    "LangChain": ("ml_framework", ["langchain"]),
    "LlamaIndex": ("ml_framework", ["llamaindex", "llama index"]),
    "OpenCV": ("ml_framework", ["opencv"]),
    "spaCy": ("ml_framework", ["spacy"]),
    "NLTK": ("ml_framework", ["nltk"]),
    # Data tooling
    "Pandas": ("data", ["pandas"]),
    "NumPy": ("data", ["numpy"]),
    "Matplotlib": ("data", ["matplotlib", "seaborn", "plotly"]),
    "Spark": ("data", ["spark", "pyspark"]),
    "Jupyter": ("data", ["jupyter"]),
    "Tableau / Power BI": ("data", ["tableau", "power ?bi"]),
    "Airflow": ("data", ["airflow"]),
    # Backend / infra
    "FastAPI": ("backend", ["fastapi"]),
    "Flask": ("backend", ["flask"]),
    "Django": ("backend", ["django"]),
    "REST APIs": ("backend", ["rest ?api", "restful"]),
    "Docker": ("infra", ["docker"]),
    "Kubernetes": ("infra", ["kubernetes", "k8s"]),
    "AWS": ("infra", ["aws", "amazon web services", "sagemaker", "ec2", "s3"]),
    "GCP": ("infra", ["gcp", "google cloud", "vertex ai", "bigquery"]),
    "Azure": ("infra", ["azure"]),
    "Git": ("infra", ["git", "github", "gitlab"]),
    "MLOps": ("infra", ["mlops", "mlflow", "kubeflow", "model deployment", "model serving"]),
    "MongoDB": ("database", ["mongodb", "mongo"]),
    "Redis": ("database", ["redis"]),
    "Vector databases": ("database", ["vector database", "vector db", "pinecone", "faiss", "chroma", "qdrant", "weaviate", "milvus"]),
    # ML concepts
    "Machine Learning": ("ml_concept", ["machine learning"]),
    "Deep Learning": ("ml_concept", ["deep learning"]),
    "Neural Networks": ("ml_concept", ["neural networks?", "mlp", "multilayer perceptron"]),
    "CNN": ("ml_concept", ["cnn", "convolutional"]),
    "RNN / LSTM": ("ml_concept", ["rnn", "lstm", "gru", "recurrent"]),
    "Transformers": ("ml_concept", ["transformers?", "attention mechanism", "bert", "gpt"]),
    "LLMs": ("ml_concept", ["llms?", "large language models?", "generative ai", "genai", "prompt engineering"]),
    "RAG": ("ml_concept", ["rag", "retrieval[- ]augmented"]),
    "NLP": ("ml_concept", ["nlp", "natural language processing", "text classification", "sentiment analysis", "named entity"]),
    "Computer Vision": ("ml_concept", ["computer vision", "image classification", "object detection", "image segmentation", "yolo"]),
    "Reinforcement Learning": ("ml_concept", ["reinforcement learning", "q-learning", "rl agent"]),
    "Regression": ("ml_concept", ["regression", "linear regression"]),
    "Logistic Regression": ("ml_concept", ["logistic regression"]),
    "Classification": ("ml_concept", ["classification", "classifier"]),
    "Clustering": ("ml_concept", ["clustering", "k-means", "kmeans", "dbscan"]),
    "Decision Trees": ("ml_concept", ["decision trees?"]),
    "Random Forest": ("ml_concept", ["random forests?"]),
    "Gradient Boosting": ("ml_concept", ["gradient boosting", "boosting", "adaboost"]),
    "SVM": ("ml_concept", ["svm", "support vector"]),
    "Naive Bayes": ("ml_concept", ["naive bayes"]),
    "KNN": ("ml_concept", ["knn", "k-nearest", "nearest neighbou?rs?"]),
    "PCA / Dimensionality Reduction": ("ml_concept", ["pca", "principal component", "dimensionality reduction", "t-sne", "umap"]),
    "Feature Engineering": ("ml_concept", ["feature engineering", "feature selection", "feature extraction"]),
    "Cross-validation": ("ml_concept", ["cross[- ]validation", "k-fold"]),
    "Hyperparameter Tuning": ("ml_concept", ["hyperparameter", "grid search", "optuna"]),
    "Model Evaluation": ("ml_concept", ["precision", "recall", "f1[- ]score", "roc", "auc", "confusion matrix", "model evaluation"]),
    "Statistics": ("ml_concept", ["statistics", "statistical", "hypothesis testing", "a/b test"]),
    "Probability / Bayesian": ("ml_concept", ["probability", "bayesian", "probabilistic"]),
    "Time Series": ("ml_concept", ["time series", "forecasting", "arima"]),
    "Recommendation Systems": ("ml_concept", ["recommend(?:er|ation) systems?", "collaborative filtering"]),
    "Optimization": ("ml_concept", ["gradient descent", "optimi[sz]ation", "adam optimizer", "sgd"]),
    "Data Cleaning": ("ml_concept", ["data cleaning", "data preprocessing", "preprocessing", "missing values", "eda", "exploratory data analysis"]),
}

DOMAINS: dict[str, list[str]] = {
    "Healthcare": ["healthcare", "medical", "clinical", "patient", "hospital"],
    "Finance": ["finance", "fintech", "banking", "trading", "credit", "fraud"],
    "E-commerce": ["e-commerce", "ecommerce", "retail", "marketplace"],
    "EdTech": ["edtech", "e-learning", "learning platform", "online courses platform"],
    "Autonomous Systems": ["autonomous", "robotics", "self-driving", "drone"],
    "Social Media / Content": ["social media", "content moderation", "recommendation feed"],
    "Agriculture": ["agriculture", "crop", "farm"],
    "Cybersecurity": ["cybersecurity", "cyber security", "intrusion detection", "malware"],
    "Telecom": ["telecom", "network traffic"],
}

SENIOR_TITLES = r"\b(senior|sr\.?|lead|principal|staff|head of|architect|manager)\b"
STUDENT_MARKERS = r"\b(student|undergraduate|b\.?tech|b\.?e\.?|bachelor|pursuing|intern(ship)?|final year|cgpa|gpa)\b"
