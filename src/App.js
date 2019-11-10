import React from 'react';
import styled from 'styled-components';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let theInterval = null;

class App extends React.Component {
  // reference to both the video and canvas
  videoRef = React.createRef();
  canvasRef = React.createRef();

  state = {
    shouldTakeSnapshot: true,
    allObjects: [],
    suspectedObjects: [],
  }

  // we are gonna use inline style
  styles = {
    position: 'fixed',
    top: 80,
  };

  detectFromVideoFrame = (model, video) => {
    model.detect(video).then(predictions => {
      // showDetection after 5 secs only....
      if(this.state.shouldTakeSnapshot) {
        this.showDetections(predictions);
        this.setState({shouldTakeSnapshot: false});
      }

      requestAnimationFrame(() => {
        this.detectFromVideoFrame(model, video);
      });
    }, (error) => {
      console.log("Couldn't start the webcam");
      console.error(error);
    });
  };

  matchObjects = (newObjects) => {  // both newObjects and allObject are arrays....
    const {allObjects} = this.state;
    const updatedObj = [];
    newObjects.forEach(newObj => {
      allObjects.forEach(obj => {
        const {height, width, title} = newObj;

        const heightAbsDiff = Math.abs(Math.floor(height) - Math.floor(obj.height));
        const widthAbsDiff = Math.abs(Math.floor(width) === Math.floor(obj.width));

        console.log(heightAbsDiff, widthAbsDiff);
        console.log(title, obj.title);

        if((heightAbsDiff < 20 && widthAbsDiff < 20 && title === obj.title)) {
          const latestTimestamp = Date.now();
          obj.latestTimestamp = latestTimestamp;
          updatedObj.push(obj);

          if(latestTimestamp - obj.timestamp >= 5000) { // checking for timestamp only...
            console.log('Unattended object detected');
            const {suspectedObjects} = this.state;
            let isAlreadyFlagged = false;
            suspectedObjects.forEach(s => {
              if(s.timestamp === obj.timestamp && s.latestTimestamp === obj.latestTimestamp) {
                isAlreadyFlagged = true;
              }
            });
            if(!isAlreadyFlagged) this.setState({suspectedObjects: [...suspectedObjects, obj]});
          }
        } else {
          newObj.timestamp = Date.now();
        }
      });
    });

    if(allObjects.length) this.setState({ allObjects: updatedObj });
  }

  showDetections = predictions => {
    const ctx = this.canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const font = "24px helvetica";
    ctx.font = font;
    ctx.textBaseline = "top";

    const newObjects = [];

    predictions.forEach(prediction => {
      const x = prediction.bbox[0];
      const y = prediction.bbox[1];
      const width = prediction.bbox[2];
      const height = prediction.bbox[3];
      const title = prediction.class;
      newObjects.push({ x, y, width, height, title });
      // Draw the bounding box.
      ctx.strokeStyle = "#2fff00";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      // Draw the label background.
      ctx.fillStyle = "#2fff00";
      const textWidth = ctx.measureText(prediction.class).width;
      const textHeight = parseInt(font, 10);
      // draw top left rectangle
      ctx.fillRect(x, y, textWidth + 10, textHeight + 10);
      // draw bottom left rectangle
      ctx.fillRect(x, y + height - textHeight, textWidth + 15, textHeight + 10);

      // Draw the text last to ensure it's on top.
      ctx.fillStyle = "#000000";
      ctx.fillText(prediction.class, x, y);
      ctx.fillText(prediction.score.toFixed(2), x, y + height - textHeight);
    });

    console.log(this.state.allObjects);

    if(this.state.allObjects.length === 0) {
      const addedTimeStampObj = newObjects.map(n => ({...n, timestamp: Date.now()}));
      this.setState({allObjects: addedTimeStampObj});
    } else {
      newObjects.length && this.matchObjects(newObjects);
    }
  };

  componentDidMount() {
    if (navigator.mediaDevices.getUserMedia || navigator.mediaDevices.webkitGetUserMedia) {
      // define a Promise that'll be used to load the webcam and read its frames
      const webcamPromise = navigator.mediaDevices
        .getUserMedia({
          video: true,
          audio: false,
        })
        .then(stream => {
          // pass the current frame to the window.stream
          window.stream = stream;
          // pass the stream to the videoRef
          this.videoRef.current.srcObject = stream;

          theInterval = setInterval(() => {
            this.setState({
              shouldTakeSnapshot: true,
            });
          }, 5000);

          return new Promise(resolve => {
            this.videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          });
        }, (error) => {
          console.log("Couldn't start the webcam");
          console.error(error);
        });

      // define a Promise that'll be used to load the model
      const loadlModelPromise = cocoSsd.load();

      // resolve all the Promises
      Promise.all([loadlModelPromise, webcamPromise])
        .then(values => {
          this.detectFromVideoFrame(values[0], this.videoRef.current);
        })
        .catch(error => {
          console.error(error);
        });
    }
  }

  // here we are returning the video frame and canvas to draw,
  // so we are in someway drawing our video "on the go"
  render() {
    const {suspectedObjects} = this.state;
    return (
      <StyledRootContainer>
        <VideoContainer
          autoPlay
          muted
          ref={this.videoRef}
          height="412px"
          width="550px"
        />
        <CanvasContainer ref={this.canvasRef} height="412px" width="550px" />
        <StreamContainer>
          <TableContainer>
            {
              suspectedObjects.length ? (
                <table style={{width: '40%', marginTop: '10vh'}}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Time First Seen</th>
                      <th>Duration</th>
                      <th>Image Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      suspectedObjects.map((s, i) => (
                        <tr key={s.title + i + s.timestamp.toString()}>
                          <td>{s.title}</td>
                          <td>{new Date(s.timestamp).toISOString()}</td>
                          <td>{Math.floor((s.latestTimestamp - s.timestamp) / 1000)}s</td>
                          <td>
                            <a href="#" target="_blank">View Image</a>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              ) : (
                <div></div>
              )
            }
          </TableContainer>
        </StreamContainer>
      </StyledRootContainer>
    );
  }
}

export default App;

const StyledRootContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StreamContainer = styled.div`
  width: 100%;
  height: 80vh;
  background-color: white;
  margin-top: 5vh;
`;

const VideoContainer = styled.video`
  position: absolute;
  top: 25vh;
  left: 10vw;
`;

const CanvasContainer = styled.canvas`
  position: absolute;
  top: 25vh;
  left: 10vw;
`;

const TableContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-right: 5vw;
`;