import ImageStudio from '../components/studio/ImageStudio';
import VideoStudio from '../components/studio/VideoStudio';
import AudioStudio from '../components/studio/AudioStudio';
import InterpolationStudio from '../components/studio/InterpolationStudio';
import HistoryGrid from '../components/history/HistoryGrid';

const Wrap = ({ show, children }) => (
  <div hidden={!show} className={show ? 'h-full' : ''}>
    {children}
  </div>
);

export default function DashboardPage({ type }) {
  return (
    <div className="h-full">
      <Wrap show={type === 'image'}>
        <ImageStudio key="text2image" mode="text2image" />
      </Wrap>
      <Wrap show={type === 'image-edit'}>
        <ImageStudio key="image2image" mode="image2image" />
      </Wrap>
      <Wrap show={type === 'video'}>
        <VideoStudio key="text2video" mode="text2video" />
      </Wrap>
      <Wrap show={type === 'image2video'}>
        <VideoStudio key="image2video" mode="image2video" />
      </Wrap>
      <Wrap show={type === 'a2v'}>
        <VideoStudio key="a2v" mode="a2v" />
      </Wrap>
      <Wrap show={type === 'audio'}>
        <AudioStudio key="speech" mode="speech" />
      </Wrap>
      <Wrap show={type === 'clone'}>
        <AudioStudio key="clone" mode="clone" />
      </Wrap>
      <Wrap show={type === 'interpolation'}>
        <InterpolationStudio key="interpolation" />
      </Wrap>
      <Wrap show={type === 'history'}>
        <HistoryGrid key="history" />
      </Wrap>
    </div>
  );
}
