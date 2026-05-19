import math
import tkinter as tk
from dataclasses import dataclass
from tkinter import ttk
from typing import List, Optional, Tuple

import pygame


# ============================================================
# Parametri generali simulazione
# ============================================================

WIDTH = 1200
HEIGHT = 800
FPS = 60

PIXELS_PER_METER = 4.0

KNOT_TO_MS = 0.514444
MS_TO_KNOT = 1.94384

DEFAULT_TROLLING_SPEED_KNOTS = 6.0
MIN_TROLLING_SPEED_KNOTS = 0.0
MAX_TROLLING_SPEED_KNOTS = 12.0
TROLLING_SPEED_STEP_KNOTS = 0.15

DEFAULT_CURRENT_SPEED_KNOTS = 0.0
DEFAULT_CURRENT_DIRECTION_DEG = 0.0
DEFAULT_LURE_MASS_G = 40.0

# Acqua di mare
WATER_DENSITY = 1025.0  # kg/m^3

# Barca
BOAT_WIDTH_M = 2.0
BOAT_LENGTH_M = 6.0

# Canne
ROD_LENGTH_M = 1.80

# Drag lenza
DRAG_COEFF_LINE = 1.1

# Drag esca: coefficiente e area uguali per tutte,
# ma la massa/peso dell'esca è configurabile per ogni canna.
DRAG_COEFF_LURE = 0.9
LURE_REFERENCE_AREA = 0.0025  # m^2

LINE_POINT_MASS = 0.08
LINE_DAMPING = 0.96

MAX_POINT_SPEED = 18.0
MAX_FORCE_LINE = 8.0
MAX_FORCE_LURE = 25.0

BOAT_TURN_RATE = 1.25
BOAT_SPEED_RESPONSE = 0.85


# ============================================================
# Configurazione
# ============================================================

@dataclass
class RodConfig:
    name: str
    trolling_depth_m: float
    line_length_m: float
    line_diameter_mm: float
    lure_mass_g: float
    rod_base_lateral_m: float
    rod_angle_deg: float


@dataclass
class SimulationConfig:
    rods: List[RodConfig]
    initial_speed_knots: float
    current_speed_knots: float
    current_direction_deg: float

    def current_vector(self) -> pygame.Vector2:
        speed_ms = self.current_speed_knots * KNOT_TO_MS
        angle_rad = math.radians(self.current_direction_deg)

        return pygame.Vector2(
            math.cos(angle_rad),
            math.sin(angle_rad)
        ) * speed_ms


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def normalize_angle_deg(angle: float) -> float:
    return (angle + 180.0) % 360.0 - 180.0


def default_rod_layout(n_rods: int) -> List[Tuple[str, float, float, float]]:
    """
    Ogni elemento:
    - nome canna
    - posizione laterale base canna in metri
    - angolo canna rispetto alla poppa in gradi
    - metri lenza filati
    """

    if n_rods == 1:
        return [
            ("Canna 1", 0.0, 0.0, 55.0),
        ]

    if n_rods == 2:
        return [
            ("Canna 1", -1.0, -90.0, 55.0),
            ("Canna 4", +1.0, +90.0, 45.0),
        ]

    if n_rods == 3:
        return [
            ("Canna 1", -1.0, -90.0, 45.0),
            ("Canna 2", -0.7, 0.0, 35.0),
            ("Canna 3", +0.7, +90.0, 550.0),
        ]

    if n_rods == 4:
        return [
            ("Canna 1", -1.0, -90.0, 60.0),
            ("Canna 2", -0.7, 0.0, 70.0),
            ("Canna 3", +0.7, 0.0, 35.0),
            ("Canna 4", +1.0, +90.0, 50.0),
        ]

    layout = []

    for i in range(n_rods):
        t = i / (n_rods - 1)
        lateral = -BOAT_WIDTH_M / 2 + t * BOAT_WIDTH_M
        angle = -90.0 + t * 180.0
        length = 35.0
        layout.append((f"Canna {i + 1}", lateral, angle, length))

    return layout


# ============================================================
# Finestra grafica configurazione
# ============================================================

class ConfigApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Configurazione simulatore traina")
        self.root.geometry("1250x820")

        self.result: Optional[SimulationConfig] = None

        self.canvas_width = 820
        self.canvas_height = 760

        self.scale_px_per_m = 70.0
        self.boat_center_x = self.canvas_width / 2
        self.boat_center_y = 300

        self.dragging_rod_index: Optional[int] = None

        self.num_rods_var = tk.IntVar(value=4)
        self.speed_var = tk.DoubleVar(value=DEFAULT_TROLLING_SPEED_KNOTS)
        self.current_speed_var = tk.DoubleVar(value=DEFAULT_CURRENT_SPEED_KNOTS)
        self.current_direction_var = tk.DoubleVar(value=DEFAULT_CURRENT_DIRECTION_DEG)

        self.rod_vars = []

        self._build_ui()
        self._rebuild_rods()

    def run(self) -> Optional[SimulationConfig]:
        self.root.mainloop()
        return self.result

    def _build_ui(self):
        main = ttk.Frame(self.root, padding=10)
        main.pack(fill="both", expand=True)

        left_container = ttk.Frame(main)
        left_container.pack(side="left", fill="y", padx=(0, 10))

        right = ttk.Frame(main)
        right.pack(side="right", fill="both", expand=True)

        # ------------------------------------------------------------
        # Pannello sinistro scrollabile
        # ------------------------------------------------------------

        self.left_canvas = tk.Canvas(
            left_container,
            width=360,
            highlightthickness=0
        )
        self.left_canvas.pack(side="left", fill="both", expand=True)

        self.left_scrollbar = ttk.Scrollbar(
            left_container,
            orient="vertical",
            command=self.left_canvas.yview
        )
        self.left_scrollbar.pack(side="right", fill="y")

        self.left_canvas.configure(yscrollcommand=self.left_scrollbar.set)

        self.left_scrollable_frame = ttk.Frame(self.left_canvas)
        self.left_window_id = self.left_canvas.create_window(
            (0, 0),
            window=self.left_scrollable_frame,
            anchor="nw"
        )

        self.left_scrollable_frame.bind(
            "<Configure>",
            lambda _event: self.left_canvas.configure(
                scrollregion=self.left_canvas.bbox("all")
            )
        )

        self.left_canvas.bind(
            "<Configure>",
            lambda event: self.left_canvas.itemconfigure(
                self.left_window_id,
                width=event.width
            )
        )

        self.left_canvas.bind_all("<MouseWheel>", self._on_mousewheel)
        self.left_canvas.bind_all("<Button-4>", self._on_mousewheel_linux)
        self.left_canvas.bind_all("<Button-5>", self._on_mousewheel_linux)

        left = self.left_scrollable_frame

        # ------------------------------------------------------------
        # Parametri generali
        # ------------------------------------------------------------

        ttk.Label(
            left,
            text="Parametri generali",
            font=("Arial", 13, "bold")
        ).pack(anchor="w")

        row = ttk.Frame(left)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="Numero canne").pack(side="left")
        spin = ttk.Spinbox(
            row,
            from_=1,
            to=8,
            textvariable=self.num_rods_var,
            width=6,
            command=self._rebuild_rods
        )
        spin.pack(side="right")
        spin.bind("<Return>", lambda _event: self._rebuild_rods())
        spin.bind("<FocusOut>", lambda _event: self._rebuild_rods())

        row = ttk.Frame(left)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="Velocità iniziale nodi").pack(side="left")
        ttk.Entry(row, textvariable=self.speed_var, width=8).pack(side="right")

        row = ttk.Frame(left)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="Velocità corrente nodi").pack(side="left")
        ttk.Entry(row, textvariable=self.current_speed_var, width=8).pack(side="right")

        row = ttk.Frame(left)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="Direzione corrente °").pack(side="left")
        ttk.Entry(row, textvariable=self.current_direction_var, width=8).pack(side="right")

        ttk.Separator(left).pack(fill="x", pady=10)

        self.rods_frame = ttk.Frame(left)
        self.rods_frame.pack(fill="both", expand=True)

        buttons = ttk.Frame(left)
        buttons.pack(fill="x", pady=10)

        ttk.Button(
            buttons,
            text="Default",
            command=self._rebuild_rods
        ).pack(side="left")

        ttk.Button(
            buttons,
            text="Avvia simulazione",
            command=self._start
        ).pack(side="right")

        # ------------------------------------------------------------
        # Pannello destro
        # ------------------------------------------------------------

        ttk.Label(
            right,
            text="Disposizione canne: trascina i pallini sulla poppa della barca",
            font=("Arial", 12, "bold")
        ).pack(anchor="w")

        self.canvas = tk.Canvas(
            right,
            width=self.canvas_width,
            height=self.canvas_height,
            bg="#1b668a"
        )
        self.canvas.pack(fill="both", expand=True)

        self.canvas.bind("<ButtonPress-1>", self._on_canvas_press)
        self.canvas.bind("<B1-Motion>", self._on_canvas_drag)
        self.canvas.bind("<ButtonRelease-1>", self._on_canvas_release)

    def _on_mousewheel(self, event):
        if event.delta == 0:
            return

        direction = -1 if event.delta > 0 else 1
        self.left_canvas.yview_scroll(direction, "units")

    def _on_mousewheel_linux(self, event):
        if event.num == 4:
            self.left_canvas.yview_scroll(-1, "units")
        elif event.num == 5:
            self.left_canvas.yview_scroll(1, "units")

    def _make_rod_var(
        self,
        name: str,
        lateral: float,
        angle: float,
        length: float
    ):
        return {
            "name": tk.StringVar(value=name),
            "depth": tk.DoubleVar(value=0.0),
            "diameter": tk.DoubleVar(value=0.60),
            "lure_mass": tk.DoubleVar(value=DEFAULT_LURE_MASS_G),
            "length": tk.DoubleVar(value=length),
            "lateral": tk.DoubleVar(value=lateral),
            "angle": tk.DoubleVar(value=angle),
        }

    def _rebuild_rods(self):
        n = clamp(int(self.num_rods_var.get()), 1, 8)
        self.num_rods_var.set(n)

        layout = default_rod_layout(n)
        self.rod_vars = [
            self._make_rod_var(name, lateral, angle, length)
            for name, lateral, angle, length in layout
        ]

        for child in self.rods_frame.winfo_children():
            child.destroy()

        ttk.Label(
            self.rods_frame,
            text="Canne",
            font=("Arial", 13, "bold")
        ).pack(anchor="w")

        for i, rv in enumerate(self.rod_vars):
            frame = ttk.LabelFrame(self.rods_frame, text=f"Canna {i + 1}", padding=6)
            frame.pack(fill="x", pady=4)

            self._entry_row(frame, "Nome", rv["name"])
            self._entry_row(frame, "Profondità m", rv["depth"])
            self._entry_row(frame, "Diametro mm", rv["diameter"])
            self._entry_row(frame, "Peso esca g", rv["lure_mass"])
            self._entry_row(frame, "Lenza m", rv["length"])
            self._entry_row(frame, "Base laterale m", rv["lateral"])
            self._entry_row(frame, "Angolo canna °", rv["angle"])

        self._draw_layout()

        if hasattr(self, "left_canvas"):
            self.root.after(50, lambda: self.left_canvas.yview_moveto(0.0))

    def _entry_row(self, parent, label: str, variable):
        row = ttk.Frame(parent)
        row.pack(fill="x", pady=1)

        ttk.Label(row, text=label).pack(side="left")

        entry = ttk.Entry(row, textvariable=variable, width=12)
        entry.pack(side="right")
        entry.bind("<KeyRelease>", lambda _event: self._draw_layout())

    def _start(self):
        rods = []

        for rv in self.rod_vars:
            lateral = clamp(
                float(rv["lateral"].get()),
                -BOAT_WIDTH_M / 2,
                BOAT_WIDTH_M / 2
            )

            rods.append(
                RodConfig(
                    name=str(rv["name"].get()),
                    trolling_depth_m=max(0.0, float(rv["depth"].get())),
                    line_length_m=max(1.0, float(rv["length"].get())),
                    line_diameter_mm=max(0.01, float(rv["diameter"].get())),
                    lure_mass_g=max(1.0, float(rv["lure_mass"].get())),
                    rod_base_lateral_m=lateral,
                    rod_angle_deg=float(rv["angle"].get()),
                )
            )

        speed = clamp(
            float(self.speed_var.get()),
            MIN_TROLLING_SPEED_KNOTS,
            MAX_TROLLING_SPEED_KNOTS
        )

        current_speed = max(0.0, float(self.current_speed_var.get()))
        current_direction = normalize_angle_deg(float(self.current_direction_var.get()))

        self.result = SimulationConfig(
            rods=rods,
            initial_speed_knots=speed,
            current_speed_knots=current_speed,
            current_direction_deg=current_direction,
        )

        self.root.destroy()

    def _boat_to_canvas(self, x_m: float, y_m: float) -> Tuple[float, float]:
        x = self.boat_center_x + x_m * self.scale_px_per_m
        y = self.boat_center_y - y_m * self.scale_px_per_m
        return x, y

    def _canvas_to_boat_lateral(self, x_px: float) -> float:
        lateral = (x_px - self.boat_center_x) / self.scale_px_per_m
        return clamp(lateral, -BOAT_WIDTH_M / 2, BOAT_WIDTH_M / 2)

    def _rod_base_canvas(self, lateral_m: float) -> Tuple[float, float]:
        y_m = -BOAT_LENGTH_M * 0.35
        return self._boat_to_canvas(lateral_m, y_m)

    def _rod_tip_canvas(self, lateral_m: float, angle_deg: float) -> Tuple[float, float]:
        base_x, base_y = self._rod_base_canvas(lateral_m)

        angle_rad = math.radians(angle_deg)

        dx = math.sin(angle_rad) * ROD_LENGTH_M * self.scale_px_per_m
        dy = math.cos(angle_rad) * ROD_LENGTH_M * self.scale_px_per_m

        return base_x + dx, base_y + dy

    def _draw_layout(self):
        self.canvas.delete("all")

        for x in range(0, self.canvas_width, 35):
            self.canvas.create_line(x, 0, x, self.canvas_height, fill="#23769e")
        for y in range(0, self.canvas_height, 35):
            self.canvas.create_line(0, y, self.canvas_width, y, fill="#23769e")

        half_w = BOAT_WIDTH_M / 2
        half_l = BOAT_LENGTH_M / 2

        stern_left = self._boat_to_canvas(-half_w, -half_l)
        stern_right = self._boat_to_canvas(+half_w, -half_l)
        mid_left = self._boat_to_canvas(-half_w, +half_l - 1.2)
        mid_right = self._boat_to_canvas(+half_w, +half_l - 1.2)
        bow_tip = self._boat_to_canvas(0.0, half_l + 0.5)

        self.canvas.create_polygon(
            stern_left[0], stern_left[1],
            stern_right[0], stern_right[1],
            mid_right[0], mid_right[1],
            bow_tip[0], bow_tip[1],
            mid_left[0], mid_left[1],
            fill="#eeeeee",
            outline="#222222",
            width=2
        )

        cabin_w = 1.05
        cabin_l = 1.55
        cabin_y = 0.45

        c1 = self._boat_to_canvas(-cabin_w / 2, cabin_y - cabin_l / 2)
        c2 = self._boat_to_canvas(+cabin_w / 2, cabin_y - cabin_l / 2)
        c3 = self._boat_to_canvas(+cabin_w / 2, cabin_y + cabin_l / 2)
        c4 = self._boat_to_canvas(-cabin_w / 2, cabin_y + cabin_l / 2)

        self.canvas.create_polygon(
            c1[0], c1[1],
            c2[0], c2[1],
            c3[0], c3[1],
            c4[0], c4[1],
            fill="#b9d6e3",
            outline="#222222",
            width=2
        )

        self.canvas.create_text(
            self.boat_center_x,
            self.boat_center_y - (half_l + 1.1) * self.scale_px_per_m,
            text="PRUA",
            fill="white",
            font=("Arial", 10, "bold")
        )

        self.canvas.create_text(
            self.boat_center_x,
            self.boat_center_y + (half_l + 0.6) * self.scale_px_per_m,
            text="POPPA",
            fill="white",
            font=("Arial", 10, "bold")
        )

        for rv in self.rod_vars:
            lateral = clamp(
                float(rv["lateral"].get()),
                -BOAT_WIDTH_M / 2,
                BOAT_WIDTH_M / 2
            )
            angle = float(rv["angle"].get())

            base = self._rod_base_canvas(lateral)
            tip = self._rod_tip_canvas(lateral, angle)

            self.canvas.create_line(
                base[0], base[1],
                tip[0], tip[1],
                fill="#222222",
                width=4
            )

            self.canvas.create_oval(
                base[0] - 7,
                base[1] - 7,
                base[0] + 7,
                base[1] + 7,
                fill="#ffffff",
                outline="#000000"
            )

            self.canvas.create_oval(
                tip[0] - 5,
                tip[1] - 5,
                tip[0] + 5,
                tip[1] + 5,
                fill="#ffd66b",
                outline="#000000"
            )

            self.canvas.create_text(
                tip[0],
                tip[1] + 18,
                text=str(rv["name"].get()),
                fill="white",
                font=("Arial", 9, "bold")
            )

    def _on_canvas_press(self, event):
        nearest_index = None
        nearest_distance = 999999.0

        for i, rv in enumerate(self.rod_vars):
            lateral = float(rv["lateral"].get())
            base_x, base_y = self._rod_base_canvas(lateral)

            dist = math.hypot(event.x - base_x, event.y - base_y)
            if dist < nearest_distance:
                nearest_distance = dist
                nearest_index = i

        if nearest_distance <= 18:
            self.dragging_rod_index = nearest_index

    def _on_canvas_drag(self, event):
        if self.dragging_rod_index is None:
            return

        lateral = self._canvas_to_boat_lateral(event.x)
        self.rod_vars[self.dragging_rod_index]["lateral"].set(round(lateral, 2))
        self._draw_layout()

    def _on_canvas_release(self, _event):
        self.dragging_rod_index = None


# ============================================================
# Simulazione pygame
# ============================================================

class Boat:
    def __init__(self, initial_speed_knots: float):
        self.position = pygame.Vector2(0, 0)
        self.velocity = pygame.Vector2(0, 0)
        self.heading_angle = 0.0

        self.target_speed_knots = initial_speed_knots
        self.target_speed_ms = self.target_speed_knots * KNOT_TO_MS

    @property
    def heading(self) -> pygame.Vector2:
        return pygame.Vector2(
            math.cos(self.heading_angle),
            math.sin(self.heading_angle)
        )

    @property
    def right(self) -> pygame.Vector2:
        h = self.heading
        return pygame.Vector2(-h.y, h.x)

    def update(self, dt: float, keys):
        if keys[pygame.K_UP]:
            self.target_speed_knots += TROLLING_SPEED_STEP_KNOTS

        if keys[pygame.K_DOWN]:
            self.target_speed_knots -= TROLLING_SPEED_STEP_KNOTS

        self.target_speed_knots = clamp(
            self.target_speed_knots,
            MIN_TROLLING_SPEED_KNOTS,
            MAX_TROLLING_SPEED_KNOTS
        )

        self.target_speed_ms = self.target_speed_knots * KNOT_TO_MS

        if keys[pygame.K_LEFT]:
            self.heading_angle -= BOAT_TURN_RATE * dt

        if keys[pygame.K_RIGHT]:
            self.heading_angle += BOAT_TURN_RATE * dt

        desired_velocity = self.heading * self.target_speed_ms

        self.velocity += (desired_velocity - self.velocity) * BOAT_SPEED_RESPONSE * dt
        self.position += self.velocity * dt


class Line:
    def __init__(self, config: RodConfig, boat_position: pygame.Vector2):
        self.config = config

        self.num_segments = max(8, int(config.line_length_m / 3.0))
        self.rest_length = config.line_length_m / self.num_segments

        self.points: List[pygame.Vector2] = []
        self.velocities: List[pygame.Vector2] = []

        for i in range(self.num_segments + 1):
            p = pygame.Vector2(
                boat_position.x - i * self.rest_length,
                boat_position.y
            )
            self.points.append(p)
            self.velocities.append(pygame.Vector2(0, 0))

    def rod_base_point(
        self,
        boat_position: pygame.Vector2,
        boat_heading: pygame.Vector2
    ) -> pygame.Vector2:
        right = pygame.Vector2(-boat_heading.y, boat_heading.x)
        stern_offset = -boat_heading * (BOAT_LENGTH_M * 0.35)

        return (
            boat_position
            + stern_offset
            + right * self.config.rod_base_lateral_m
        )

    def rod_tip_point(
        self,
        boat_position: pygame.Vector2,
        boat_heading: pygame.Vector2
    ) -> pygame.Vector2:
        base = self.rod_base_point(boat_position, boat_heading)

        backward = -boat_heading
        right = pygame.Vector2(-boat_heading.y, boat_heading.x)

        angle_rad = math.radians(self.config.rod_angle_deg)

        rod_direction = (
            backward * math.cos(angle_rad)
            + right * math.sin(angle_rad)
        )

        if rod_direction.length() < 1e-9:
            rod_direction = backward
        else:
            rod_direction = rod_direction.normalize()

        return base + rod_direction * ROD_LENGTH_M

    def update(
        self,
        dt: float,
        boat_position: pygame.Vector2,
        boat_heading: pygame.Vector2,
        boat_velocity: pygame.Vector2,
        current_vector: pygame.Vector2,
    ):
        anchor = self.rod_tip_point(boat_position, boat_heading)

        self.points[0] = pygame.Vector2(anchor)
        self.velocities[0] = pygame.Vector2(boat_velocity)

        diameter_m = self.config.line_diameter_mm / 1000.0
        segment_length = self.rest_length

        for i in range(1, len(self.points)):
            point = self.points[i]
            velocity = self.velocities[i]

            force = pygame.Vector2(0, 0)

            relative_velocity = velocity - current_vector
            speed = relative_velocity.length()

            # -------------------------------
            # Drag della lenza
            # -------------------------------
            if speed > 1e-6:
                projected_area_line = diameter_m * segment_length

                drag_line = (
                    0.5
                    * WATER_DENSITY
                    * DRAG_COEFF_LINE
                    * projected_area_line
                    * speed * speed
                )

                drag_line = min(drag_line, MAX_FORCE_LINE)
                force += -relative_velocity.normalize() * drag_line

            # -------------------------------
            # Drag dell'esca
            # -------------------------------
            if i == len(self.points) - 1 and speed > 1e-6:
                drag_lure = (
                    0.5
                    * WATER_DENSITY
                    * DRAG_COEFF_LURE
                    * LURE_REFERENCE_AREA
                    * speed * speed
                )

                drag_lure = min(drag_lure, MAX_FORCE_LURE)
                force += -relative_velocity.normalize() * drag_lure

            # -------------------------------
            # Massa efficace
            # -------------------------------
            depth_factor = 1.0 + self.config.trolling_depth_m / 25.0

            if i == len(self.points) - 1:
                lure_mass_kg = self.config.lure_mass_g / 1000.0
                effective_mass = LINE_POINT_MASS * depth_factor + lure_mass_kg
            else:
                effective_mass = LINE_POINT_MASS * depth_factor

            acceleration = force / effective_mass

            velocity += acceleration * dt

            if velocity.length() > MAX_POINT_SPEED:
                velocity.scale_to_length(MAX_POINT_SPEED)

            velocity *= LINE_DAMPING
            point += velocity * dt

            if not math.isfinite(point.x) or not math.isfinite(point.y):
                point = pygame.Vector2(self.points[i - 1])
                velocity = pygame.Vector2(0, 0)

            self.points[i] = point
            self.velocities[i] = velocity

        # Vincoli di lunghezza: lenza quasi inestensibile.
        for _ in range(8):
            self.points[0] = pygame.Vector2(anchor)

            for i in range(len(self.points) - 1):
                p1 = self.points[i]
                p2 = self.points[i + 1]

                delta = p2 - p1
                distance = delta.length()

                if distance < 1e-9:
                    continue

                difference = (distance - self.rest_length) / distance

                if i == 0:
                    self.points[i + 1] -= delta * difference
                else:
                    correction = delta * 0.5 * difference
                    self.points[i] += correction
                    self.points[i + 1] -= correction

        for i in range(1, len(self.points)):
            if self.velocities[i].length() > MAX_POINT_SPEED:
                self.velocities[i].scale_to_length(MAX_POINT_SPEED)


def world_to_screen(
    point: pygame.Vector2,
    camera: pygame.Vector2
) -> Optional[Tuple[int, int]]:
    x = WIDTH / 2 + (point.x - camera.x) * PIXELS_PER_METER
    y = HEIGHT / 2 + (point.y - camera.y) * PIXELS_PER_METER

    if not math.isfinite(x) or not math.isfinite(y):
        return None

    return int(round(x)), int(round(y))


def draw_boat(screen, boat: Boat, camera: pygame.Vector2):
    heading = boat.heading
    right = boat.right

    half_length = BOAT_LENGTH_M / 2
    half_width = BOAT_WIDTH_M / 2

    bow_tip = boat.position + heading * (half_length + 0.35)
    bow_left = boat.position + heading * (half_length - 1.10) - right * half_width
    bow_right = boat.position + heading * (half_length - 1.10) + right * half_width

    mid_left = boat.position - right * half_width
    mid_right = boat.position + right * half_width

    stern_left = boat.position - heading * half_length - right * half_width
    stern_right = boat.position - heading * half_length + right * half_width

    hull_points_world = [
        bow_tip,
        bow_right,
        mid_right,
        stern_right,
        stern_left,
        mid_left,
        bow_left,
    ]

    hull_points = [world_to_screen(p, camera) for p in hull_points_world]

    if any(p is None for p in hull_points):
        return

    pygame.draw.polygon(screen, (235, 235, 235), hull_points)
    pygame.draw.polygon(screen, (25, 25, 25), hull_points, 2)

    cabin_center = boat.position + heading * 0.45
    cabin_length = 1.65
    cabin_width = 1.05

    c_front_left = cabin_center + heading * (cabin_length / 2) - right * (cabin_width / 2)
    c_front_right = cabin_center + heading * (cabin_length / 2) + right * (cabin_width / 2)
    c_rear_right = cabin_center - heading * (cabin_length / 2) + right * (cabin_width / 2)
    c_rear_left = cabin_center - heading * (cabin_length / 2) - right * (cabin_width / 2)

    cabin_points = [
        world_to_screen(c_front_left, camera),
        world_to_screen(c_front_right, camera),
        world_to_screen(c_rear_right, camera),
        world_to_screen(c_rear_left, camera),
    ]

    if not any(p is None for p in cabin_points):
        pygame.draw.polygon(screen, (180, 210, 225), cabin_points)
        pygame.draw.polygon(screen, (25, 25, 25), cabin_points, 2)

    stern_line_a = world_to_screen(stern_left, camera)
    stern_line_b = world_to_screen(stern_right, camera)

    if stern_line_a is not None and stern_line_b is not None:
        pygame.draw.line(screen, (20, 20, 20), stern_line_a, stern_line_b, 4)

    engine_center = boat.position - heading * (half_length + 0.35)
    engine_length = 0.55
    engine_width = 0.45

    e_front_left = engine_center + heading * (engine_length / 2) - right * (engine_width / 2)
    e_front_right = engine_center + heading * (engine_length / 2) + right * (engine_width / 2)
    e_rear_right = engine_center - heading * (engine_length / 2) + right * (engine_width / 2)
    e_rear_left = engine_center - heading * (engine_length / 2) - right * (engine_width / 2)

    engine_points = [
        world_to_screen(e_front_left, camera),
        world_to_screen(e_front_right, camera),
        world_to_screen(e_rear_right, camera),
        world_to_screen(e_rear_left, camera),
    ]

    if not any(p is None for p in engine_points):
        pygame.draw.polygon(screen, (45, 45, 45), engine_points)
        pygame.draw.polygon(screen, (10, 10, 10), engine_points, 2)


def draw_rods(screen, boat: Boat, lines: List[Line], camera: pygame.Vector2):
    for line in lines:
        base = line.rod_base_point(boat.position, boat.heading)
        tip = line.rod_tip_point(boat.position, boat.heading)

        base_screen = world_to_screen(base, camera)
        tip_screen = world_to_screen(tip, camera)

        if base_screen is None or tip_screen is None:
            continue

        pygame.draw.line(screen, (40, 40, 40), base_screen, tip_screen, 4)
        pygame.draw.circle(screen, (40, 40, 40), base_screen, 3)
        pygame.draw.circle(screen, (250, 220, 120), tip_screen, 3)


def draw_line(screen, line: Line, camera: pygame.Vector2, color):
    screen_points = []

    for p in line.points:
        sp = world_to_screen(p, camera)
        if sp is not None:
            screen_points.append(sp)

    if len(screen_points) >= 2:
        pygame.draw.lines(screen, color, False, screen_points, 2)

    if screen_points:
        pygame.draw.circle(screen, color, screen_points[-1], 6)
        pygame.draw.circle(screen, (20, 20, 20), screen_points[-1], 6, 1)


def draw_hud(screen, font, boat: Boat, config: SimulationConfig):
    real_speed_knots = boat.velocity.length() * MS_TO_KNOT

    route_angle_deg = math.degrees(boat.heading_angle)
    route_angle_deg = normalize_angle_deg(route_angle_deg)

    y = 12

    texts = [
        f"Velocita traina target: {boat.target_speed_knots:.2f} nodi",
        f"Velocita reale barca:   {real_speed_knots:.2f} nodi",
        f"Angolo rotta barca:     {route_angle_deg:+.1f} gradi",
        f"Corrente:               {config.current_speed_knots:.2f} nodi @ {config.current_direction_deg:+.0f} gradi",
        "SU/GIU: cambia velocita | SINISTRA/DESTRA: ruota | ESC: esci",
    ]

    for text in texts:
        surface = font.render(text, True, (255, 255, 255))
        screen.blit(surface, (12, y))
        y += 24


def draw_grid(screen, camera: pygame.Vector2):
    grid_spacing_m = 20
    grid_spacing_px = grid_spacing_m * PIXELS_PER_METER

    offset_x = (-camera.x * PIXELS_PER_METER) % grid_spacing_px
    offset_y = (-camera.y * PIXELS_PER_METER) % grid_spacing_px

    x = offset_x
    while x < WIDTH:
        pygame.draw.line(screen, (30, 90, 130), (x, 0), (x, HEIGHT), 1)
        x += grid_spacing_px

    y = offset_y
    while y < HEIGHT:
        pygame.draw.line(screen, (30, 90, 130), (0, y), (WIDTH, y), 1)
        y += grid_spacing_px


def run_simulation(config: SimulationConfig):
    pygame.init()
    pygame.display.set_caption("Simulatore lenze da traina")

    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    font = pygame.font.SysFont("consolas", 18)

    boat = Boat(config.initial_speed_knots)
    lines = [Line(rod, boat.position) for rod in config.rods]

    colors = [
        (255, 220, 120),
        (120, 220, 255),
        (255, 140, 140),
        (180, 255, 160),
        (220, 160, 255),
        (255, 255, 255),
        (255, 180, 80),
        (160, 220, 220),
    ]

    running = True

    while running:
        dt = clock.tick(FPS) / 1000.0
        dt = min(dt, 0.03)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        keys = pygame.key.get_pressed()

        if keys[pygame.K_ESCAPE]:
            running = False

        boat.update(dt, keys)

        current_vector = config.current_vector()

        for line in lines:
            line.update(
                dt,
                boat.position,
                boat.heading,
                boat.velocity,
                current_vector
            )

        camera = boat.position

        screen.fill((20, 70, 105))

        draw_grid(screen, camera)

        for i, line in enumerate(lines):
            draw_line(screen, line, camera, colors[i % len(colors)])

        draw_boat(screen, boat, camera)
        draw_rods(screen, boat, lines, camera)
        draw_hud(screen, font, boat, config)

        pygame.display.flip()

    pygame.quit()


def main():
    app = ConfigApp()
    config = app.run()

    if config is None:
        return

    run_simulation(config)


if __name__ == "__main__":
    main()