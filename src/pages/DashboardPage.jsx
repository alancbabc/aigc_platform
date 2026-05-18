import ImageStudio from '../components/studio/ImageStudio';
import VideoStudio from '../components/studio/VideoStudio';
import AudioStudio from '../components/studio/AudioStudio';
import HistoryGrid from '../components/history/HistoryGrid';

export default function DashboardPage({ type }) {
  switch (type) {
    case 'image':
      return <ImageStudio />;
    case 'video':
      return <VideoStudio />;
    case 'audio':
      return <AudioStudio />;
    case 'history':
      return <HistoryGrid />;
    default:
      return <ImageStudio />;
  }
}
