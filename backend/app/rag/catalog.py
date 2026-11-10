"""Static catalogue: the provided books and the roles they serve.

Each role owns a *primary* knowledge base (the books PGAGI assigned to it) and an
optional *advanced* tier (Bishop / AI-ML-DL) that is unlocked only when the resume
indicates a strong candidate - this is one of the ways the resume steers retrieval.

`competencies` are the evaluation areas for the role. Their `keywords` are matched
against the parsed resume to measure skill/role alignment, and their `seed_queries`
are written in textbook vocabulary so retrieval hits explanatory passages rather
than prefaces or exercises.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Book:
    id: str
    title: str
    author: str
    filename: str
    level: str  # foundational | applied | advanced
    color: str  # UI accent


@dataclass(frozen=True)
class Competency:
    id: str
    name: str
    keywords: tuple[str, ...]
    seed_queries: tuple[str, ...]


@dataclass(frozen=True)
class Role:
    id: str
    title: str
    tagline: str
    description: str
    primary_books: tuple[str, ...]
    advanced_books: tuple[str, ...]
    competencies: tuple[Competency, ...] = field(default_factory=tuple)


BOOKS: dict[str, Book] = {
    b.id: b
    for b in [
        Book("mitchell", "Machine Learning", "Tom M. Mitchell", "MachineLearningTomMitchell.pdf", "foundational", "#8b5cf6"),
        Book(
            "ml_beginners",
            "Machine Learning for Absolute Beginners",
            "Oliver Theobald",
            "Machine Learning For Absolute Beginners.pdf",
            "foundational",
            "#22d3ee",
        ),
        Book(
            "intro_ml_python",
            "Introduction to Machine Learning with Python",
            "Andreas C. Müller & Sarah Guido",
            "Introduction to Machine Learning with Python ( PDFDrive.com )-min.pdf",
            "applied",
            "#34d399",
        ),
        Book(
            "master_ml_algorithms",
            "Master Machine Learning Algorithms",
            "Jason Brownlee",
            "Master Machine Learning Algorithms - Discover how they work and Implement Them From Scratch by Jason Brownlee (z-lib.org).pdf",
            "applied",
            "#fbbf24",
        ),
        Book(
            "bishop_prml",
            "Pattern Recognition and Machine Learning",
            "Christopher M. Bishop",
            "Bishop-Pattern-Recognition-and-Machine-Learning-2006.pdf",
            "advanced",
            "#f472b6",
        ),
        Book(
            "ai_ml_dl",
            "Artificial Intelligence, Machine Learning, and Deep Learning",
            "Oswald Campesato",
            "Artificial Intelligence, Machine Learning, and Deep Learning.pdf",
            "advanced",
            "#60a5fa",
        ),
    ]
}


def _c(id: str, name: str, keywords: list[str], queries: list[str]) -> Competency:
    return Competency(id, name, tuple(keywords), tuple(queries))


ROLES: dict[str, Role] = {
    r.id: r
    for r in [
        Role(
            id="ai_ml_engineer",
            title="AI / ML Engineer",
            tagline="Learning theory, models & neural networks",
            description=(
                "Builds and ships learning systems. Evaluated on core ML theory, model families, "
                "neural networks, generalisation and how learning algorithms actually work."
            ),
            primary_books=("mitchell", "ml_beginners"),
            advanced_books=("ai_ml_dl", "bishop_prml"),
            competencies=(
                _c("learning_foundations", "Learning foundations & hypothesis spaces",
                   ["machine learning", "supervised learning", "inductive bias", "hypothesis", "generalization"],
                   ["inductive bias and hypothesis space search", "concept learning general-to-specific ordering"]),
                _c("decision_trees", "Decision trees & information gain",
                   ["decision tree", "random forest", "xgboost", "gradient boosting", "entropy", "id3"],
                   ["decision tree learning information gain entropy", "avoiding overfitting in decision trees pruning"]),
                _c("neural_networks", "Neural networks & backpropagation",
                   ["neural network", "deep learning", "pytorch", "tensorflow", "keras", "backpropagation", "cnn", "rnn", "lstm", "transformer"],
                   ["backpropagation algorithm gradient descent hidden units", "perceptron training rule and delta rule"]),
                _c("bayesian_learning", "Bayesian & probabilistic learning",
                   ["naive bayes", "bayesian", "probability", "statistics", "probabilistic"],
                   ["Bayes theorem maximum a posteriori hypothesis", "naive Bayes classifier conditional independence"]),
                _c("evaluation", "Evaluating hypotheses & overfitting",
                   ["evaluation", "cross-validation", "overfitting", "metrics", "a/b testing", "accuracy"],
                   ["estimating hypothesis accuracy sample error confidence intervals", "overfitting training error versus true error"]),
                _c("instance_based", "Instance-based learning & clustering",
                   ["knn", "k-nearest", "clustering", "k-means", "similarity", "recommendation"],
                   ["k-nearest neighbor learning distance weighted", "k-means clustering centroids"]),
                _c("reinforcement", "Reinforcement learning",
                   ["reinforcement learning", "q-learning", "reward", "agent", "policy"],
                   ["Q learning reward policy agent", "temporal difference learning"]),
                _c("deep_learning", "Modern deep learning architectures",
                   ["deep learning", "cnn", "rnn", "lstm", "transformer", "nlp", "computer vision", "llm", "generative"],
                   ["convolutional neural network layers", "recurrent neural networks LSTM sequence"]),
            ),
        ),
        Role(
            id="data_scientist",
            title="Data Scientist / Applied ML",
            tagline="Algorithms, pipelines & model evaluation",
            description=(
                "Turns data into models that work in practice. Evaluated on algorithm intuition, "
                "feature engineering, model selection, evaluation and the scikit-learn workflow."
            ),
            primary_books=("intro_ml_python", "master_ml_algorithms"),
            advanced_books=("bishop_prml",),
            competencies=(
                _c("supervised_algorithms", "Supervised learning algorithms",
                   ["regression", "classification", "logistic regression", "svm", "knn", "naive bayes", "supervised learning"],
                   ["linear models for classification and regression", "support vector machines margin kernel"]),
                _c("ensembles", "Trees & ensemble methods",
                   ["random forest", "xgboost", "gradient boosting", "lightgbm", "decision tree", "bagging", "ensemble"],
                   ["random forests bagging bootstrap", "gradient boosted regression trees learning rate"]),
                _c("feature_engineering", "Data representation & feature engineering",
                   ["feature engineering", "pandas", "preprocessing", "data cleaning", "one-hot", "scaling", "etl"],
                   ["one-hot encoding categorical variables", "preprocessing and scaling features StandardScaler"]),
                _c("model_evaluation", "Model evaluation & selection",
                   ["cross-validation", "metrics", "precision", "recall", "roc", "auc", "grid search", "hyperparameter"],
                   ["cross-validation grid search parameter selection", "evaluation metrics precision recall ROC curve"]),
                _c("unsupervised", "Unsupervised learning & dimensionality reduction",
                   ["clustering", "k-means", "pca", "dimensionality reduction", "dbscan", "unsupervised"],
                   ["principal component analysis dimensionality reduction", "clustering k-means DBSCAN agglomerative"]),
                _c("bias_variance", "Bias-variance & generalisation",
                   ["overfitting", "regularization", "bias", "variance", "generalization"],
                   ["bias variance trade-off overfitting underfitting", "regularization ridge lasso"]),
                _c("pipelines", "ML pipelines & workflow",
                   ["scikit-learn", "sklearn", "pipeline", "mlops", "deployment", "production"],
                   ["scikit-learn pipeline chaining preprocessing and model", "algorithm chains and pipelines"]),
            ),
        ),
        Role(
            id="ml_research",
            title="ML Research / Advanced",
            tagline="Probabilistic modelling & theory",
            description=(
                "For strong candidates. Evaluated on probability theory, Bayesian inference, kernel methods, "
                "graphical models and the mathematics underpinning modern ML."
            ),
            primary_books=("bishop_prml", "ai_ml_dl"),
            advanced_books=("mitchell",),
            competencies=(
                _c("probability", "Probability distributions & inference",
                   ["probability", "statistics", "bayesian", "gaussian", "distribution"],
                   ["Gaussian distribution maximum likelihood", "Bayesian inference conjugate prior"]),
                _c("linear_models", "Linear models for regression & classification",
                   ["regression", "logistic regression", "linear model", "classification"],
                   ["Bayesian linear regression predictive distribution", "logistic regression probabilistic discriminative models"]),
                _c("kernels", "Kernel methods & SVMs",
                   ["svm", "kernel", "gaussian process"],
                   ["kernel trick kernel functions", "maximum margin classifiers support vectors"]),
                _c("graphical_models", "Graphical models",
                   ["graphical model", "bayesian network", "markov", "hmm"],
                   ["Bayesian networks conditional independence d-separation", "Markov random fields"]),
                _c("latent_variables", "Mixture models & EM",
                   ["em", "mixture", "clustering", "latent", "gmm"],
                   ["EM algorithm Gaussian mixtures", "latent variables expectation maximization"]),
                _c("nn_theory", "Neural networks: theory & training",
                   ["neural network", "deep learning", "pytorch", "tensorflow", "backpropagation", "optimization"],
                   ["error backpropagation network training", "regularization in neural networks"]),
                _c("approx_inference", "Approximate inference & sampling",
                   ["variational", "sampling", "mcmc", "monte carlo"],
                   ["variational inference", "Markov chain Monte Carlo sampling"]),
            ),
        ),
    ]
}


def get_role(role_id: str) -> Role | None:
    return ROLES.get(role_id)
