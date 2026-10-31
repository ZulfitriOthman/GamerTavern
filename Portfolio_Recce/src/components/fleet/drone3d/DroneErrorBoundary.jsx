import { Component } from "react";

// The 3D experience is a progressive enhancement. If it throws for any reason
// (WebGL context loss, driver quirks, an unexpected R3F error), fall back to
// the 2D pseudo-3D presentation silently rather than showing a broken canvas.
class DroneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) {
      console.warn("Drone 3D experience failed, falling back to static presentation:", error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default DroneErrorBoundary;
