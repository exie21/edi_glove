export interface BridgeGoal {
  goal_lat: number;
  goal_lon: number;
  goal_heading: number;
}

export interface GoalStatus {
  state: string;
  message: string;
  goal: BridgeGoal | null;
  updated_at_sec: number;
}

export interface PathPoint {
  index: number;
  x_m: number;
  y_m: number;
  latitude_deg: number;
  longitude_deg: number;
  target_velocity_mps?: number;
  target_heading_deg?: number;
  velocity_mps?: number;
  acceleration_mps2?: number;
  curvature?: number;
  relative_time_sec?: number;
  intersection_id?: number;
  turn_direction?: number;
  is_before_lane_change?: boolean;
}

export interface BridgePathSnapshot {
  source: string;
  point_count: number;
  snapshot_point_count: number;
  age_sec?: number | null;
  reverse?: boolean;
  points: PathPoint[];
}

export interface BridgeInfo {
  mode: string;
  last_control_source: string;
  service_name: string;
  service_ready: boolean;
  api_host: string;
  api_port: number;
  map_preset?: string;
}

export interface EgoState {
  x_m: number;
  y_m: number;
  speed_mps: number;
  psi_rad: number;
  heading_deg: number;
  latitude_deg: number;
  longitude_deg: number;
  origin: {
    latitude_deg: number;
    longitude_deg: number;
  };
}

export interface ManualCommand {
  throttle: number;
  brake: number;
  steer: number;
}

export interface ControllerCommand {
  throttle_mps2: number;
  brake_mps2: number;
  steering_column_deg: number;
  age_sec: number | null;
}

export interface MissionWaypoint {
  id?: string;
  label?: string;
  goal_lat: number;
  goal_lon: number;
  goal_heading?: number;
}

export interface MissionStatus {
  state: string;
  message: string;
  active: boolean;
  waypoint_count: number;
  completed_count: number;
  current_index: number | null;
  current_label: string | null;
  current_waypoint: MissionWaypoint | null;
  reach_radius_m: number;
  waypoints: MissionWaypoint[];
}

export interface BridgeSceneObject {
  id: string;
  kind: 'traffic_light' | 'barrel' | 'stop_sign';
  label: string;
  latitude_deg: number;
  longitude_deg: number;
  trigger_radius_m: number;
  min_trigger_radius_m: number;
  height_m: number;
  width_m: number;
  elevation_m: number;
  facing_deg?: number;
  facing_fov_deg?: number;
  stopbar_offset_m?: number;
  sign_type?: string;
  traffic_light_state?: string;
}

export interface GeneratedMockPerceptionWorldStatus {
  path: string | null;
  auto_write_enabled: boolean;
  object_count: number;
  last_written_at_sec: number | null;
  last_error: string | null;
}

export interface SceneStatus {
  object_count: number;
  objects: BridgeSceneObject[];
  publish_to_perception: boolean;
  trigger_fov_deg: number;
  generated_mock_perception_world: GeneratedMockPerceptionWorldStatus;
}

export interface BridgeState {
  api_version: string;
  display_name: string;
  bridge_name: string;
  bridge: BridgeInfo;
  ego: EgoState;
  manual_command: ManualCommand;
  controller_command: ControllerCommand;
  goal_status: GoalStatus;
  route: BridgePathSnapshot;
  reference_trajectory: BridgePathSnapshot;
  predicted_path: BridgePathSnapshot;
  debug_reference_path: BridgePathSnapshot;
  mission: MissionStatus;
  scene: SceneStatus;
}

export interface ModePayload {
  mode: 'manual' | 'auto';
}

export interface GoalPayload {
  goal_lat: number;
  goal_lon: number;
  goal_heading?: number;
}

export interface ResetVehiclePayload {
  x_m?: number;
  y_m?: number;
  speed_mps?: number;
  heading_deg?: number;
  latitude_deg?: number;
  longitude_deg?: number;
}

export interface MissionStartPayload {
  auto_mode?: boolean;
  waypoints: MissionWaypoint[];
}

export interface SceneObjectPayload {
  id: string;
  kind: 'traffic_light' | 'barrel' | 'stop_sign';
  label: string;
  latitude_deg: number;
  longitude_deg: number;
  facing_deg?: number;
  stopbar_offset_m?: number;
}

export interface SceneSyncPayload {
  objects: SceneObjectPayload[];
}

export interface CommandAck {
  accepted: boolean;
  command?: string;
  error?: string;
}

export interface KeyboardState {
  forward: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  hardBrake: boolean;
}
