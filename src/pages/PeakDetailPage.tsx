import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import PeakDetailTemplate from "../components/PeakDetailTemplate";

export default function PeakDetailPage() {
  const { peakId } = useParams();
  const isTemplate = peakId === "preview";

  if (isTemplate) {
    return (
      <div className="content-page content-page--detail">
        <Link to="/peaks" className="back-link">
          <Icon name="arrow" size={15} /> Back to peaks
        </Link>
        <PeakDetailTemplate />
      </div>
    );
  }

  return (
    <div className="content-page">
      <Link to="/peaks" className="back-link">
        <Icon name="arrow" size={15} /> Back to peaks
      </Link>
      <PageHeader
        index="02"
        eyebrow="Peaks / Detail"
        title={
          <>
            No peak <span className="display-italic">record</span>.
          </>
        }
        description={`The route for “${peakId ?? "this peak"}” is ready, but no mountain record is connected in Phase 01.`}
      />
      <EmptyState
        eyebrow="Peak detail"
        title="This summit is not indexed yet."
        description="The reusable peak template is in place. It will carry elevation, prominence, location, range, a map and personal actions once a real peak dataset is introduced."
      >
        <Link to="/peaks/preview" className="text-link">
          Open the peak template <Icon name="arrow" size={16} />
        </Link>
      </EmptyState>
    </div>
  );
}
