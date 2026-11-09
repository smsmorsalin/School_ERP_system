import { Link } from "react-router-dom";
import { ArrowLeft, Compass, Home } from "lucide-react";
import { EmptyState } from "../components/ui";

export default function NotFound() {
  return (
    <div style={{ padding: "48px 12px" }}>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for may have moved, or the address may be incorrect."
        action={
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/" className="btn btn-primary" style={{ textDecoration: "none" }}>
              <Home size={16} /> Back to dashboard
            </Link>
            <button type="button" className="btn btn-secondary" onClick={() => window.history.back()}>
              <ArrowLeft size={16} /> Go back
            </button>
          </div>
        }
      />
    </div>
  );
}
