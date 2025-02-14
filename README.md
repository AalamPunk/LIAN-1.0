# Pathfinding Visualizer

This project is a pathfinding visualizer built using Flask. It allows users to visualize various pathfinding algorithms in action.

## Project Structure

```
pathfinding-visualizer
├── app.py                # Main application file
├── requirements.txt      # Project dependencies
├── README.md             # Project documentation
├── templates             # HTML templates
│   └── index.html       # Main page template
└── static                # Static files
    ├── style.css        # CSS styles
    └── scripts.js       # JavaScript code
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd pathfinding-visualizer
   ```

2. Create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

1. Run the application:
   ```
   python app.py
   ```

2. Open your web browser and navigate to `http://127.0.0.1:5000` to access the pathfinding visualizer.

## Features

- Visualize different pathfinding algorithms.
- Interactive user interface for selecting start and end points.
- Real-time updates of the pathfinding process.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.