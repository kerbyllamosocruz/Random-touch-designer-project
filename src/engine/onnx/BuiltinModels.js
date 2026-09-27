export const BUILTIN_MODELS = {
  selfie_segmentation: {
    id: 'selfie_segmentation',
    name: 'Selfie Person Segmentation',
    category: 'Vision / Matte',
    url: '/models/selfie_segmentation.onnx',
    inputName: 'pixel_values',
    outputName: 'alphas',
    inputShape: [1, 3, 256, 256],
    type: 'segmentation',
    normalize: 'zero_to_one', // [0, 1]
    color: '#06b6d4',
    description: 'Real-time human body segmentation & background matte extraction.'
  },
  sobel_edge: {
    id: 'sobel_edge',
    name: 'Neural Sobel Edge Tensor',
    category: 'Convolution / Filter',
    url: '/models/sobel_edge.onnx',
    inputName: 'input',
    outputName: 'output',
    inputShape: [1, 3, 256, 256],
    type: 'edge_filter',
    normalize: 'zero_to_one',
    color: '#a855f7',
    description: 'High-speed tensor convolution gradient magnitude edge extractor.'
  },
  neural_filter: {
    id: 'neural_filter',
    name: 'Cyber Neural Color Grade',
    category: 'Convolution / Style',
    url: '/models/neural_filter.onnx',
    inputName: 'input',
    outputName: 'output',
    inputShape: [1, 3, 256, 256],
    type: 'color_filter',
    normalize: 'zero_to_one',
    color: '#ec4899',
    description: 'Neural color tint matrix, high-contrast vibrance & edge sharpening.'
  },
  squeezenet: {
    id: 'squeezenet',
    name: 'SqueezeNet 1.1 Classifier',
    category: 'Vision / Classifier',
    url: '/models/squeezenet1.1.onnx',
    inputName: 'data',
    outputName: 'squeezenet0_flatten0_reshape0',
    inputShape: [1, 3, 224, 224],
    type: 'classification',
    normalize: 'imagenet', // subtract mean, divide std
    color: '#10b981',
    description: 'Deep CNN classifying 1,000 visual object classes to drive CHOP channels.'
  },
  custom: {
    id: 'custom',
    name: 'Custom .ONNX Model Loader',
    category: 'Custom Model',
    url: null,
    type: 'custom',
    color: '#f59e0b',
    description: 'Load any custom exported .onnx model file (YOLO, MiDaS, FaceMesh, etc).'
  }
};
