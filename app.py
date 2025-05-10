import heapq
import math
from flask import Flask, render_template, jsonify, request, send_file
import osmnx as ox
from haversine import haversine
from flask import Flask, render_template, redirect, url_for, request, session
from flask_sqlalchemy import SQLAlchemy
from flask import flash
from models import db, User  
app = Flask(__name__)
app.secret_key = 'your_secret_key'

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if not username or not password:
            flash('Please fill out both fields.')
            return render_template('register.html')

        # Check if user already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already exists.')
            return render_template('register.html')

        # Save password as plain text (not secure)
        new_user = User(username=username, password=password)
        db.session.add(new_user)
        db.session.commit()

        flash('Registration successful! Please log in.')
        return redirect(url_for('login'))
    return render_template('register.html')


# --- LOGIN SECTION START ---

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:password@localhost:5432/LIAN'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

@app.route('/')
def dashboard_wol():
    return render_template('dashboard_wol.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user = User.query.filter_by(username=username, password=password).first()
        if user:
            session['user'] = user.username
            return redirect('/dashboard')
        else:
            return "Invalid credentials"
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    if 'user' in session:
        return render_template('dashboard.html', user=session['user'])
    return redirect('/')

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect('/')

@app.route('/profile')
def profile():
    if 'user' in session:
        user = User.query.filter_by(username=session['user']).first()
        if user:
            return render_template('profile.html', user=user)
    return redirect('/')

@app.route('/delete-profile', methods=['POST'])
def delete_profile():
    if 'user' in session:
        user = User.query.filter_by(username=session['user']).first()
        if user:
            db.session.delete(user)
            db.session.commit()
            session.pop('user', None)
            flash('Profile deleted successfully.')
    return redirect('/')


@app.route('/main')
def main_app():
    if 'user' in session:
        # Add values as per your application's needs
        return render_template('index.html', user=session['user'], default_lat=19.0760, default_lon=72.8777)
    return redirect('/')

# --- LOGIN SECTION END ---

def haversine_distance(coord1, coord2):
    R = 6371  # Earth radius in km
    lat1, lon1 = math.radians(coord1[0]), math.radians(coord1[1])
    lat2, lon2 = math.radians(coord2[0]), math.radians(coord2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def dijkstra_path_with_steps(G, start, goal):
    visited = []  # Order of node expansion.
    queue = [(0, start, [start])]
    seen = {start: 0}
    while queue:
        cost, node, path = heapq.heappop(queue)
        if node not in visited:
            visited.append(node)
        if node == goal:
            return path, visited
        for neighbor in G.neighbors(node):
            new_cost = cost + G[node][neighbor].get('length', 1)
            if neighbor not in seen or new_cost < seen[neighbor]:
                seen[neighbor] = new_cost
                heapq.heappush(queue, (new_cost, neighbor, path + [neighbor]))
    return None, visited

def astar_path_with_steps(G, start, goal):
    """
    Implements A* search on the graph G from start to goal.
    
    Returns:
        path: List of nodes representing the optimal path.
        visited: Order in which nodes were permanently expanded.
    """
    visited = []  # Order of node expansion.
    
    # Euclidean distance heuristic
    def heuristic(n):
        y1, x1 = G.nodes[n]['y'], G.nodes[n]['x']
        y2, x2 = G.nodes[goal]['y'], G.nodes[goal]['x']
        return ((y1 - y2)**2 + (x1 - x2)**2)**0.5

    # Each entry in the priority queue is a tuple:
    # (estimated_total_cost, current_cost, current_node, path_taken)
    queue = [(heuristic(start), 0, start, [start])]
    seen = {start: 0}

    import heapq
    while queue:
        est_total, cost, node, path = heapq.heappop(queue)
        
        if node not in visited:
            visited.append(node)
       
        # Goal check
        if node == goal:
            return path, visited
        
        # Expand neighbors
        for neighbor in G.neighbors(node):
            # Get the cost to traverse from node to neighbor (default to 1 if not set)
            edge_length = G[node][neighbor].get('length', 1)
            new_cost = cost + edge_length
            
            if neighbor not in seen or new_cost < seen[neighbor]:
                seen[neighbor] = new_cost
                estimated_cost = new_cost + heuristic(neighbor)
                heapq.heappush(queue, (estimated_cost, new_cost, neighbor, path + [neighbor]))
    
    # If goal is not reachable
    return None, visited

def best_first_search_with_steps(G, start, goal):
    """
    Implements Best First Search using only the heuristic (Euclidean distance) to drive the selection.
    It records the order of node expansions.
    """
    visited = []  # Order of node expansion.
    def heuristic(n):
        y1, x1 = G.nodes[n]['y'], G.nodes[n]['x']
        y2, x2 = G.nodes[goal]['y'], G.nodes[goal]['x']
        return ((y1 - y2)**2 + (x1 - x2)**2)**0.5
    queue = [(heuristic(start), start, [start])]
    seen = set([start])
    while queue:
        h, node, path = heapq.heappop(queue)
        if node not in visited:
            visited.append(node)
        if node == goal:
            return path, visited
        for neighbor in G.neighbors(node):
            if neighbor not in seen:
                seen.add(neighbor)
                heapq.heappush(queue, (heuristic(neighbor), neighbor, path + [neighbor]))
    return None, visited

def bellman_ford_path_with_steps(G, start, goal):
    """
    Implements the Bellman-Ford algorithm on graph G from start to goal.
    
    Returns:
        path: List of nodes representing the optimal path (if exists), otherwise None.
        visited_order: The order in which nodes were updated (for visualization).
    """
    # Initialize distances and predecessor pointers.
    dist = {node: float('inf') for node in G.nodes}
    predecessor = {node: None for node in G.nodes}
    dist[start] = 0
    visited_order = [start]
    
    # Relax edges for |V| - 1 iterations.
    for i in range(len(G.nodes) - 1):
        for u, v, data in G.edges(data=True):
            edge_length = data.get('length', 1)
            if dist[u] + edge_length < dist[v]:
                dist[v] = dist[u] + edge_length
                predecessor[v] = u
                if v not in visited_order:
                    visited_order.append(v)
            # For undirected graphs, check the reverse direction.
            if not G.is_directed():
                if dist[v] + edge_length < dist[u]:
                    dist[u] = dist[v] + edge_length
                    predecessor[u] = v
                    if u not in visited_order:
                        visited_order.append(u)
    
    # Optionally, check for negative weight cycles.
    for u, v, data in G.edges(data=True):
        edge_length = data.get('length', 1)
        if dist[u] + edge_length < dist[v]:
            print("Graph contains a negative weight cycle")
            return None, visited_order
    
    # Reconstruct the optimal path from start to goal.
    path = []
    current = goal
    while current is not None:
        path.append(current)
        current = predecessor[current]
    path.reverse()
    
    # Verify that a valid path was found.
    if path[0] == start:
        return path, visited_order
    return None, visited_order

@app.route('/')
def index():
    # Default focus on Mumbai.
    mumbai = {'lat': 19.0760, 'lon': 72.8777}  # Mumbai's coordinates
    return render_template('index.html', default_lat=mumbai['lat'], default_lon=mumbai['lon'], autofocus_location=mumbai)

@app.route('/get-path', methods=['POST'])
def get_path():
    data = request.json
    start = (data['start_lat'], data['start_lon'])
    end = (data['end_lat'], data['end_lon'])
    algorithm = data['algorithm']

    # Compute a bounding box with a margin.
    margin = 0.02  # degrees; adjust as needed.
    north = max(start[0], end[0]) + margin
    south = min(start[0], end[0]) - margin
    east  = max(start[1], end[1]) + margin
    west  = min(start[1], end[1]) - margin

    # Create a smaller graph over the bounding box.
    G = ox.graph_from_bbox(north, south, east, west, network_type="drive")
    G = G.to_undirected()

    # Find nearest nodes.
    start_node = ox.distance.nearest_nodes(G, start[1], start[0])
    end_node = ox.distance.nearest_nodes(G, end[1], end[0])

    # Choose the algorithm.
    if algorithm == "astar":
        final_path, visited_nodes = astar_path_with_steps(G, start_node, end_node)
    elif algorithm == "best":
        final_path, visited_nodes = best_first_search_with_steps(G, start_node, end_node)
    elif algorithm == "dijkstra":
        final_path, visited_nodes = dijkstra_path_with_steps(G, start_node, end_node)
    elif algorithm == "bellman-ford":
        final_path, visited_nodes = bellman_ford_path_with_steps(G, start_node, end_node)
    else:
        final_path, visited_nodes = dijkstra_path_with_steps(G, start_node, end_node)

    # Build final route coordinates using detailed edge geometry when available.
    final_route_coords = []
    for i in range(len(final_path) - 1):
        u = final_path[i]
        v = final_path[i+1]
        edge_data = G.get_edge_data(u, v)
        if edge_data:
            key = list(edge_data.keys())[0]
            ed = edge_data[key]
            if 'geometry' in ed:
                coords = [(pt[1], pt[0]) for pt in list(ed['geometry'].coords)]
            else:
                coords = [(G.nodes[u]['y'], G.nodes[u]['x']),
                          (G.nodes[v]['y'], G.nodes[v]['x'])]
        else:
            coords = [(G.nodes[u]['y'], G.nodes[u]['x']),
                      (G.nodes[v]['y'], G.nodes[v]['x'])]
        if i == 0:
            final_route_coords.extend(coords)
        else:
            if final_route_coords[-1] == coords[0]:
                final_route_coords.extend(coords[1:])
            else:
                final_route_coords.extend(coords)
    if final_route_coords and final_route_coords[0] == final_route_coords[-1]:
        final_route_coords.pop()

    # Build exploration coordinates as node centers.
    # Instead of flat tuples, build objects with more details.
    exploration_markers = [{
        "lat": G.nodes[n]['y'],
        "lon": G.nodes[n]['x'],
        "radius": 10,  # example radius in pixels/units; adjust on front-end as needed
        "order": idx + 1  # order in which the node was expanded
    } for idx, n in enumerate(visited_nodes)]

    # Build exploration segments based on edges between visited nodes.
    exploration_segments = []
    for i in range(len(visited_nodes) - 1):
        u = visited_nodes[i]
        v = visited_nodes[i+1]
        edge_data = G.get_edge_data(u, v)
        if edge_data:
            key = list(edge_data.keys())[0]
            ed = edge_data[key]
            if 'geometry' in ed:
                # Missing code: e.g.
                seg = [(pt[1], pt[0]) for pt in list(ed['geometry'].coords)]
            else:
                seg = [(G.nodes[u]['y'], G.nodes[u]['x']),
                       (G.nodes[v]['y'], G.nodes[v]['x'])]
        else:
            # Fallback if no edge data available
            seg = [(G.nodes[u]['y'], G.nodes[u]['x']),
                   (G.nodes[v]['y'], G.nodes[v]['x'])]
        exploration_segments.append(seg)

    # Compute total distance.
    start = (G.nodes[start_node]['y'], G.nodes[start_node]['x'])
    end = (G.nodes[end_node]['y'], G.nodes[end_node]['x'])
    total_distance = haversine(start, end) * 1000  # in meters

    return jsonify({
        "final_path": final_route_coords,
        "exploration": exploration_markers,
        "distance": total_distance,
        "num_explored": len(visited_nodes),
        "num_final_path": len(final_path)
    })

@app.route('/report')
def report():
    # Update the path below if you move the file to another location (e.g., static folder)
    return send_file(r'c:/Users/ozair/OneDrive/Documents/LIAN_Report.pdf', mimetype='application/pdf')

if __name__ == '__main__':
    app.run(debug=True)