
import bpy
import math

# ----------------------------------------------------------------------
# DIMENSIONS (en metres)
# ----------------------------------------------------------------------
BODY_LENGTH = 0.090
BODY_DIAMETER = 0.046
HEAD_LENGTH = 0.028
LEG_HEIGHT = 0.022
LEG_SPREAD = 0.055
PORT_DIAMETER = 0.010
PORT_LENGTH = 0.024

# ----------------------------------------------------------------------
# COULEURS (R, G, B, A)
# ----------------------------------------------------------------------
BODY_COLOR = (0.06, 0.06, 0.06, 1.0)
RED_WIRE_COLOR = (0.75, 0.05, 0.05, 1.0)
BLACK_WIRE_COLOR = (0.02, 0.02, 0.02, 1.0)

_material_cache = {}


def get_material(color, name):
    key = tuple(round(c, 4) for c in color)
    if key in _material_cache:
        return _material_cache[key]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.55
    _material_cache[key] = mat
    return mat


def clear_existing_pump():
    old = bpy.data.objects.get("PumpModel")
    if old:
        to_delete = [old] + list(old.children_recursive)
        for obj in to_delete:
            bpy.data.objects.remove(obj, do_unlink=True)


def add_cylinder(name, radius, depth, location, rotation_euler, color, parent):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, location=location, rotation=rotation_euler
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(get_material(color, f"Mat_{name}"))
    obj.parent = parent
    return obj


def add_cube(name, size_xyz, location, color, parent):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size_xyz
    obj.data.materials.append(get_material(color, f"Mat_{name}"))
    obj.parent = parent
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def create_port(parent, base_pos, direction_sign, index_label):
    """direction_sign = +1 (droite / +Y) ou -1 (gauche / -Y)."""
    d = 1 if direction_sign > 0 else -1
    port_center = (
        base_pos[0],
        base_pos[1] + d * (PORT_LENGTH * 0.9),
        base_pos[2],
    )
    add_cylinder(
        f"Port_{index_label}",
        PORT_DIAMETER / 2,
        PORT_LENGTH,
        port_center,
        (math.radians(90), 0, 0),
        (BODY_COLOR[0] * 1.1, BODY_COLOR[1] * 1.1, BODY_COLOR[2] * 1.1, 1.0),
        parent,
    )
    collar_center = (
        base_pos[0],
        base_pos[1] + d * (PORT_LENGTH * 0.35),
        base_pos[2],
    )
    add_cylinder(
        f"PortCollar_{index_label}",
        PORT_DIAMETER * 0.65,
        0.003,
        collar_center,
        (math.radians(90), 0, 0),
        BODY_COLOR,
        parent,
    )


def create_leg(parent, top_pos, index_label):
    """
    top_pos = (x, y_desire, z_centre_du_corps).
    Le corps est un cylindre rond : une patte plantee plus loin que son
    rayon ne peut jamais le toucher (toujours un vide). On ancre donc une
    colonne (riser) a une position Y ramenee a l'interieur du rayon, puis
    un bras horizontal (bridge) rejoint le pied large -- comme une vraie
    equerre de fixation pliee.
    """
    radius = BODY_DIAMETER / 2
    half_width = 0.005
    x, desired_y, body_center_z = top_pos

    safe_y = math.copysign(min(abs(desired_y), radius * 0.55), desired_y)

    max_reach_sq = (radius ** 2) - (abs(safe_y) + half_width) ** 2
    embed_offset_z = math.sqrt(max_reach_sq) * 0.85 if max_reach_sq > 0 else 0.003
    leg_top_z = max(body_center_z - embed_offset_z, 0.006)

    # Colonne d'ancrage (riser) : fusionnee dans le corps.
    add_cube(
        f"LegRiser_{index_label}",
        (half_width * 2, half_width * 2, leg_top_z),
        (x, safe_y, leg_top_z / 2),
        BODY_COLOR,
        parent,
    )

    # Bras horizontal (bridge) vers le pied large, si necessaire.
    if abs(desired_y - safe_y) > 0.0005:
        bridge_height = min(leg_top_z, LEG_HEIGHT * 0.6)
        y_center = (safe_y + desired_y) / 2
        y_scale = abs(desired_y - safe_y) + half_width * 2
        add_cube(
            f"LegBridge_{index_label}",
            (half_width * 2, y_scale, bridge_height),
            (x, y_center, bridge_height / 2),
            BODY_COLOR,
            parent,
        )

    # Pied large, pose au sol.
    add_cube(
        f"Foot_{index_label}",
        (0.020, 0.020, 0.004),
        (x, desired_y, 0.002),
        BODY_COLOR,
        parent,
    )

    # Trou de vis de fixation (visuel).
    add_cylinder(
        f"Hole_{index_label}",
        0.003,
        0.0025,
        (x, desired_y, 0.004),
        (0, 0, 0),
        (0.0, 0.0, 0.0, 1.0),
        parent,
    )


def create_wire(parent, start, color, side_sign, name):
    curve_data = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.bevel_depth = 0.0025
    curve_data.bevel_resolution = 4

    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(4)  # total 5 points

    for i, bp in enumerate(spline.bezier_points):
        t = i / 4
        x = start[0] - t * 0.03
        y = start[1] + side_sign * t * 0.02
        z = start[2] - t * 0.04
        bp.co = (x, y, z)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"

    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(get_material(color, f"Mat_{name}"))
    obj.parent = parent
    return obj


def generate_pump():
    clear_existing_pump()

    root = bpy.data.objects.new("PumpModel", None)
    bpy.context.collection.objects.link(root)

    radius = BODY_DIAMETER / 2
    body_center_z = LEG_HEIGHT + radius

    motor_end_x = -BODY_LENGTH / 2
    head_end_x = BODY_LENGTH / 2
    head_center_x = head_end_x - HEAD_LENGTH / 2

    # Corps principal.
    add_cylinder(
        "Body", radius, BODY_LENGTH, (0, 0, body_center_z),
        (0, math.radians(90), 0), BODY_COLOR, root,
    )

    # Capuchon cote moteur.
    add_cylinder(
        "EndCap", radius * 0.9, 0.004,
        (motor_end_x + 0.004, 0, body_center_z),
        (0, math.radians(90), 0),
        (BODY_COLOR[0] * 0.8, BODY_COLOR[1] * 0.8, BODY_COLOR[2] * 0.8, 1.0),
        root,
    )

    # Bloc collecteur (tete).
    add_cylinder(
        "Head", radius * 1.15, HEAD_LENGTH, (head_center_x, 0, body_center_z),
        (0, math.radians(90), 0), BODY_COLOR, root,
    )

    # Les 2 embouts, alignes horizontalement : un a droite (+Y), un a
    # gauche (-Y), au meme niveau que le centre du corps.
    port_base = (head_center_x, 0, body_center_z)
    create_port(root, port_base, +1, "R")
    create_port(root, port_base, -1, "L")

    # 4 pattes de fixation.
    leg_x_motor = motor_end_x + BODY_LENGTH * 0.16
    leg_x_head = head_center_x - HEAD_LENGTH * 0.1
    leg_y = LEG_SPREAD / 2
    create_leg(root, (leg_x_motor, leg_y, body_center_z), "1")
    create_leg(root, (leg_x_motor, -leg_y, body_center_z), "2")
    create_leg(root, (leg_x_head, leg_y, body_center_z), "3")
    create_leg(root, (leg_x_head, -leg_y, body_center_z), "4")

    # Fils electriques (rouge/noir) cote moteur.
    wire_start = (motor_end_x + 0.002, 0, body_center_z - radius * 0.2)
    create_wire(root, (wire_start[0], wire_start[1] + radius * 0.4, wire_start[2]),
                RED_WIRE_COLOR, 1, "WireRed")
    create_wire(root, (wire_start[0], wire_start[1] - radius * 0.4, wire_start[2]),
                BLACK_WIRE_COLOR, -1, "WireBlack")

    print("Pump model generated under 'PumpModel'.")
    return root


if __name__ == "__main__":
    generate_pump()
