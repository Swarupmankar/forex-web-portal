"use client";
import { Component, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { reportClientError } from "@/lib/clientErrors";

type Props = { name: string; className: string; resetKey: string; children: ReactNode };
type State = { error: Error | null; resetKey: string };

// Keeps a crash inside one panel (chart, watchlist, ticket, activity) from blanking the terminal.
// The fallback keeps the panel's grid slot, and the panel resets when the symbol or account changes.
export class PanelBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  static getDerivedStateFromProps(props: Props, state: State) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }
  componentDidCatch(error: Error) {
    reportClientError(error, { panel: this.props.name });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className={`${this.props.className} panel panel-fallback`} role="alert">
        <TriangleAlert />
        <strong>The {this.props.name} couldn’t be displayed.</strong>
        <p>Your positions and orders are unaffected.</p>
        <button className="button button-outline" onClick={() => this.setState({ error: null })}>
          <RefreshCw />
          Reload {this.props.name}
        </button>
      </section>
    );
  }
}
