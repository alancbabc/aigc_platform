import ImageStudio from '../components/studio/ImageStudio';
import VideoStudio from '../components/studio/VideoStudio';
import AudioStudio from '../components/studio/AudioStudio';
import InterpolationStudio from '../components/studio/InterpolationStudio';
import HistoryGrid from '../components/history/HistoryGrid';

export default function DashboardPage({ type }) {
  switch (type) {
    case 'image':
      return <ImageStudio mode="text2image" />;
    case 'image-edit':
      return <ImageStudio mode="image2image" />;
    case 'video':
      return <VideoStudio mode="text2video" />;
    case 'image2video':
      return <VideoStudio mode="image2video" />;
    case 'a2v':
      return <VideoStudio mode="a2v" />;
    case 'audio':
      return <AudioStudio mode="speech" />;
    case 'clone':
      return <AudioStudio mode="clone" />;
    case 'interpolation':
      return <InterpolationStudio />;
    case 'history':
      return <HistoryGrid />;
    default:
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl text-white/10 font-bold mb-2">404</p>
            <p className="text-sm text-white/30">未知页面类型</p>
          </div>
        </div>
      );
  }
}
