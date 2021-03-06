
var THREE = require('three');

let WAGNER = require('@superguigui/wagner')


import QuadNoise from './object/Quad+noise';
import PlaneAudio from './object/PlaneAudio';
import Plane from './object/Plane';
// import AudioAnalyser from './AudioAnalyser';

var createPlayer = require('web-audio-player')
var createAnalyser = require('web-audio-analyser')
var audio = createPlayer('medias/Veens-Girl.mp3')



var DisplacementPass = require('./postprocessing/displacement-pass/Displacement');
var VignettePass = require('./postprocessing/vignette-white/VignettePass');
var LutPass = require('@superguigui/wagner/src/passes/lookup/lookup');
var FXAAPass = require('@superguigui/wagner/src/passes/fxaa/FXAAPASS');



const glslify = require('glslify');

export default class Webgl {
  constructor(device,width, height, canvas) {

    this.params = {
      name:"Fluctus",
      usePostprocessing: true
    }

    this.mouse ={
      x:0,
      y:0
    }
    this.device = device;
    this.divisorX = (this.device === "desktop") ?5:1;
    this.divisorY = (this.device === "desktop")?50:25;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, width / height, 1, 1000000);
    this.camera.position.z = 220;

    this.renderer = new THREE.WebGLRenderer({
      canvas:canvas
    });
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0xe7e0ff);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMapSoft = true;

    this.composer = null;

    // this.initGui();
    this.initPostprocessing();
    this.createAudioTexture();
    this.addObjects(width,height);

  }
  createAudioTexture(){
    let size = 12;
    this.data = new Float32Array(size * size *3);
    this.volume = 1;

    for (let i = 0,  l = this.data.length; i < l; i += 3) {
        this.data[i] =0.0;
        this.data[i+1] =0.0;
        this.data[i+2] =0.0;
    }

    this.audio = createPlayer('medias/Veens-Girl.mp3',{
       buffer: (this.desktop === 'desktop')?false:true
    })
    this.analyser = createAnalyser(this.audio.node, this.audio.context, {
      stereo: false
    })

    this.textureData = new THREE.DataTexture(this.data, size, size, THREE.RGBFormat, THREE.FloatType);
    this.textureData.minFilter = this.textureData.magFilter = THREE.NearestFilter;
  }
  addObjects(width,height) {
    this.sceneRt = new THREE.Scene();
    this.cameraRt = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, -10000, 10000 );
    this.rendererRt = new THREE.WebGLRenderer();
    this.rendererRt.setSize(width, height);
    this.rendererRt.setClearColor(0x383838);

  	this.rtTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, format: THREE.RGBFormat } );

    this.quadNoise = new QuadNoise();
    // this.quadNoise.addGUI(this.folder);
    this.sceneRt.add( this.quadNoise );

    this.planeAudio = new PlaneAudio(this.rtTexture, this.textureData);
    // this.planeAudio.addGUI(this.folder);
    this.scene.add(this.planeAudio);

    this.plane = new Plane();
    this.scene.add(this.plane);

    this.spotLight = new THREE.SpotLight( 0xffffff );
    this.spotLight.position.set( 0, 1000, 0 );
    this.spotLight.castShadow = true;
    this.spotLight.shadowMapWidth = 1024;
    this.spotLight.shadowMapHeight = 1024;
    this.spotLight.shadowDarkness = 0.4;
    this.scene.add( this.spotLight );
  }

  initGui() {

    this.folder = window.gui.addFolder(this.params.name);
    this.folder.open();

  }
  initPostprocessing() {

    this.composer = new WAGNER.Composer(this.renderer);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    window.composer = this.composer;

    this.vignettePass = new VignettePass();
    this.vignettePass.params.boost = 1.2;
    this.vignettePass.params.reduction = 0.26;
    // this.folder.add(this.vignettePass.params,'boost').min(0.01).max(2.5)
    // this.folder.add(this.vignettePass.params,'reduction').min(0.01).max(2.5)

    this.displacementPass = new DisplacementPass();
    this.displacementPass.params.amount = 0.0099;

    this.fxaaPass = new FXAAPass();

    this.lutPass = new LutPass();

    // this.folder.add(this.displacementPass.params,'amount').min(0.001).max(0.05)

    var loader = new THREE.TextureLoader();

    loader.load('images/displace.jpg',(texture)=> {
      let textureDisplacement = texture;
      textureDisplacement.minFilter = textureDisplacement.magFilter = THREE.LinearFilter;
      textureDisplacement.wrapS = textureDisplacement.wrapT = THREE.RepeatWrapping;
      this.displacementPass.params.uDisplacement = textureDisplacement;
    });

    loader.load('images/lookup_blue.png',(texture)=> {
      let lookup =texture
      lookup.minFilter = lookup.magFilter = THREE.LinearFilter;
      this.lutPass.params.uLookup = lookup;
    });

  }
  resize(width, height) {
      if (this.composer) {
          this.composer.setSize(width, height);
      }
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
  }
  mousemove(x,y) {

      this.mouse.x = (x - window.innerWidth/2) /this.divisorX;
      this.mouse.y = (y - window.innerHeight/2) /this.divisorY;
  }
  render() {

    if (this.params.usePostprocessing) {
        this.composer.reset();
        this.composer.render(this.scene, this.camera);

        this.composer.pass(this.displacementPass);

        this.composer.pass(this.lutPass);
        this.composer.pass(this.vignettePass);
        this.composer.pass(this.fxaaPass);

        this.composer.toScreen();

    } else {
        this.renderer.render(this.scene, this.camera);
    }

    this.camera.position.x += ( this.mouse.x - this.camera.position.x ) * 0.05;
    this.camera.position.y += ( -this.mouse.y - this.camera.position.y ) * 0.05;
    this.camera.lookAt( this.scene.position );


    this.rendererRt.render( this.sceneRt, this.cameraRt);
    this.renderer.render( this.sceneRt, this.cameraRt, this.rtTexture, true );

    let freq = this.analyser.frequencies();
    let _acuteAverage = 0;
    let _volume = 0;
    for (var i = 0; i < freq.length; i++) {
        this.data[i] = freq[i]/256.;
        _volume += freq[i]/256.
        if(i> 174 - 5) {
           _acuteAverage += freq[i]/256.;
        }
    }
    if((_acuteAverage/4)>65)
          this.planeAudio.toogleWireframe();

    this.volume = _volume/freq.length;
    this.textureData.needsUpdate = true;

    this.quadNoise.update();
    this.plane.update();
    this.planeAudio.update(this.rtTexture,this.textureData,this.volume);
  }

  destroy() {
    gui.removeFolder(this.params.name);
  }
}
