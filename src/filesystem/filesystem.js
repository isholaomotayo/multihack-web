/* globals JSZip, JSZipUtils, CodeMirror */

var File = require('./file')
var Directory = require('./directory')
var util = require('./util')
var Interface = require('./../interface/interface')

var ignoredFilenames = ['__MACOSX', '.DS_Store']

function FileSystem () {
  var self = this
  if (!(self instanceof FileSystem)) return new FileSystem()
  
  self._tree = [
    new Directory('')
  ]
}

// Takes a zip file and loads the project
FileSystem.prototype.loadProject = function (file, cb) {
  var self = this
  self.unzip(file, function () {
    console.log('done')
    cb(self._tree[0].nodes)
  })
  
  // TODO: More input options
}

FileSystem.prototype.saveProject = function (saveType, cb) {
  var self = this
  
  if (saveType === 'zip') {
      try {
        var isFileSaverSupported = !!new Blob

        var zip = new JSZip()
        util.zipTree(zip, self._tree[0].nodes)

        zip.generateAsync({type: 'blob'}).then(function (content) {
          saveAs(content, 'myProject.zip')
          cb(true)
        })
      } catch (err) {
        console.error(err)
        cb(false)
      }
  }
}

FileSystem.prototype.mkdir = function (path) {
  var self = this
  var self = this
  var parentPath = path.split('/')
  parentPath.splice(-1,1)
  parentPath = parentPath.join('/')
  
  self._buildPath(parentPath)
  self._getNode(parentPath).nodes.push(new Directory(path))
}

FileSystem.prototype.mkfile = function (path) {
  var self = this
  var parentPath = path.split('/')
  parentPath.splice(-1,1)
  parentPath = parentPath.join('/')

  self._buildPath(parentPath)
  self._getNode(parentPath).nodes.push(new File(path))
}

// Ensures all directories have been build along path
FileSystem.prototype._buildPath = function (path) {
  var self = this
  
  var split = path.split('/')
  for (var i=0; i<=split.length; i++) {
    var check = split.slice(0,i).join('/')
    if (!self._getNode(check)) {
      self.mkdir(check)
    }
  }
}

// Recursive search
FileSystem.prototype._getNode = function (path, nodeList) {
  var self = this
  nodeList = nodeList || self._tree
  for (var i = 0; i < nodeList.length; i++) { 
      if (nodeList[i].path === path) {
          return nodeList[i]
      } else if (nodeList[i].isDir) {
          var recur = self._getNode(path, nodeList[i].nodes) 
          if (recur) return recur
      }
  }
  return undefined
}

FileSystem.prototype.get = function (path) {
  var self = this
  
  var parentPath = path.split('/')
  parentPath.splice(-1,1)
  parentPath = parentPath.join('/')
  
  self._buildPath(parentPath)
  return self._getNode(path)
}

FileSystem.prototype.getFile = function (path) {
  var self = this
  
  var parentPath = path.split('/')
  parentPath.splice(-1,1)
  parentPath = parentPath.join('/')
  
  self._buildPath(parentPath)
  return self._getNode(path) || (function () {
    self.mkfile(path)
    self._getNode(path).doc = new CodeMirror.Doc('', util.pathToMode(path))
    Interface.treeview.render(self._tree[0].nodes)
    console.log(self._tree)
    return self._getNode(path)
  }())
}

FileSystem.prototype.delete = function (path) {
  var self = this
  var parentPath = relativePath.split('/')
  parentPath.splice(-1,1)
  parentPath = parentPath.join('/')
  self._getNode(parentPath).nodes = self._getNode(parentPath).nodes.filter(function (e) {
    if (e.path === path) {
      return false
    }
    return true
  })
}

FileSystem.prototype.getTree = function () {
  var self = this

  return self._tree[0].nodes
}

// Takes a zip file and writes to the directory
FileSystem.prototype.unzip = function (file, cb) {
  var self = this
  
  JSZip.loadAsync(file).then(function (zip) {
    
    var awaiting = Object.keys(zip.files).length
    var first = true
    
    zip.forEach(function (relativePath, zipEntry) {  
      if (first) {
        first = false
        awaiting--
        return
      }

      // Filter out ignored files
      for (var i=0; i<ignoredFilenames.length; i++) {
        if (relativePath.indexOf(ignoredFilenames[i]) !== -1) {
          if (--awaiting <= 0) cb() 
          return
        }
      } 
      
      relativePath = relativePath.split('/')
      relativePath.splice(0,1)
      relativePath = relativePath.join('/')
      relativePath='/'+relativePath
      
      if (zipEntry.dir) {
        relativePath = relativePath.slice(0, -1)
      }
      
      var parentPath = relativePath.split('/')
      parentPath.splice(-1,1)
      parentPath = parentPath.join('/')
      
      if (zipEntry.dir) {
        self.mkdir(relativePath)
        if (--awaiting <= 0) cb() 
      } else {
        self.mkfile(relativePath)
        var viewMapping = util.getViewMapping(relativePath)
        switch (viewMapping) {
          case 'image':
            zipEntry.async('base64').then(function (content) {  
              self.get(relativePath).doc = content
              if (--awaiting <= 0) cb() 
            })
            break
          default:
            // Load as text
            zipEntry.async('string').then(function (content) {  
              self.get(relativePath).doc = new CodeMirror.Doc(content, util.pathToMode(relativePath))
              if (--awaiting <= 0) cb() 
            })
            break
        }
      }   
    })
  })
}
    
module.exports = new FileSystem()